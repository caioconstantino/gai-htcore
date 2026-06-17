import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { AIProviderFactory } from "../ai/factory.js";
import { buildAgentContext } from "./context.js";
import { selectAgent } from "./selector.js";
import { analyzeSentiment } from "./sentiment.js";
import { routeToSpecialists } from "./router.js";
import { runSpecialistsInParallel } from "./specialist-runner.js";
import type { WhatsAppMessage } from "../types.js";
import type { SpecialistResult } from "./specialist-runner.js";

export interface OrchestratorInput {
  companyId: string;
  phoneNumberId: string;
  from: string;
  message: WhatsAppMessage;
}

export async function orchestrate(input: OrchestratorInput): Promise<string> {
  const { companyId, from, message } = input;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { commercialRules: true },
  });

  if (!company || !company.isActive) {
    logger.warn(`Company ${companyId} not found or inactive`);
    return "";
  }

  if (company.tokensUsed >= company.tokenLimit) {
    logger.warn(`Company ${companyId} reached token limit`);
    return "Nosso atendimento está temporariamente indisponível. Por favor, entre em contato pelo telefone.";
  }

  // Lead e conversa
  const lead = await prisma.lead.upsert({
    where: { companyId_phone: { companyId, phone: from } },
    create: { companyId, phone: from, source: "whatsapp" },
    update: { lastInteractionAt: new Date() },
  });

  let conversation = await prisma.conversation.findFirst({
    where: { companyId, leadId: lead.id, isActive: true },
    include: { currentAgent: true },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { companyId, leadId: lead.id },
      include: { currentAgent: true },
    });
  }

  if (conversation.handedOffToHuman) return "";

  const userText = message.text?.body ?? "";

  await prisma.message.create({
    data: {
      companyId,
      leadId: lead.id,
      conversationId: conversation.id,
      direction: "inbound",
      content: userText,
      type: "text",
      whatsappMessageId: message.id,
      status: "delivered",
    },
  });

  const cacheKey = `conv:${conversation.id}:history`;
  const cachedHistory = await redis.get(cacheKey);
  const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = cachedHistory
    ? JSON.parse(cachedHistory)
    : [];

  const sentiment = await analyzeSentiment(userText);
  const aiProvider = AIProviderFactory.create(company.aiProvider, company.aiModel);

  // ── Busca todos os agentes ativos da empresa ─────────────────────────
  const allAgents = await prisma.agent.findMany({
    where: { companyId, isActive: true },
  });

  const orchestratorAgent = allAgents.find((a) => a.type === "orchestrator");
  const specialists = allAgents.filter((a) => a.type !== "orchestrator" && a.scope === "external");

  let finalResponse: string;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let primaryAgentId: string | null = orchestratorAgent?.id ?? null;

  if (orchestratorAgent && specialists.length > 0) {
    // ── FLUXO MULTI-AGENTE ──────────────────────────────────────────────
    logger.info("Using orchestrator multi-agent flow", {
      companyId,
      specialistCount: specialists.length,
    });

    // 1. Router: decide quais especialistas consultar
    const selectedSpecialists = await routeToSpecialists(userText, specialists, aiProvider);

    // 2. Especialistas rodam em paralelo
    const specialistResults = await runSpecialistsInParallel(selectedSpecialists, {
      company,
      lead,
      conversation,
      userMessage: userText,
      history,
      aiProvider,
      sentiment,
    });

    specialistResults.forEach((r) => {
      totalTokensIn += r.tokensIn;
      totalTokensOut += r.tokensOut;
    });

    // 3. Orquestrador sintetiza as respostas dos especialistas
    const synthPrompt = buildSynthesizerPrompt(orchestratorAgent.prompt, specialistResults);

    const { response, tokensIn, tokensOut } = await aiProvider.chat({
      systemPrompt: synthPrompt,
      history,
      userMessage: userText,
    });

    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    finalResponse = response;
  } else if (orchestratorAgent && specialists.length === 0) {
    // Orquestrador sem especialistas: responde sozinho
    const agentContext = await buildAgentContext({
      company,
      lead,
      conversation,
      agent: orchestratorAgent,
      sentiment,
    });

    const { response, tokensIn, tokensOut } = await aiProvider.chat({
      systemPrompt: agentContext,
      history,
      userMessage: userText,
    });

    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    finalResponse = response;
  } else {
    // ── FLUXO LEGADO (sem orquestrador) ────────────────────────────────
    const selectedAgent = await selectAgent({
      userMessage: userText,
      currentAgentId: conversation.currentAgentId ?? undefined,
      agents: specialists.length > 0 ? specialists : allAgents,
      context: conversation.context as Record<string, unknown>,
    });

    if (!selectedAgent) return "Olá! Como posso te ajudar hoje?";

    primaryAgentId = selectedAgent.id;

    if (conversation.currentAgentId !== selectedAgent.id) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { currentAgentId: selectedAgent.id },
      });
    }

    const agentContext = await buildAgentContext({
      company,
      lead,
      conversation,
      agent: selectedAgent,
      sentiment,
    });

    const { response, tokensIn, tokensOut } = await aiProvider.chat({
      systemPrompt: agentContext,
      history,
      userMessage: userText,
    });

    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    finalResponse = response;
  }

  // ── Pós-processamento ─────────────────────────────────────────────────
  const needsHandoff = finalResponse.includes("[TRANSBORDO]");
  const cleanResponse = finalResponse.replace("[TRANSBORDO]", "").trim();

  history.push({ role: "user", content: userText });
  history.push({ role: "assistant", content: cleanResponse });
  await redis.setex(cacheKey, 86400, JSON.stringify(history.slice(-20)));

  const totalTokens = totalTokensIn + totalTokensOut;

  await Promise.all([
    prisma.message.create({
      data: {
        companyId,
        leadId: lead.id,
        conversationId: conversation.id,
        direction: "outbound",
        content: cleanResponse,
        type: "text",
        agentId: primaryAgentId,
        status: "pending",
        tokensUsed: totalTokens,
      },
    }),
    prisma.company.update({
      where: { id: companyId },
      data: { tokensUsed: { increment: totalTokens } },
    }),
    prisma.tokenUsageLog.create({
      data: {
        companyId,
        agentId: primaryAgentId,
        conversationId: conversation.id,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        totalTokens,
        model: company.aiModel,
      },
    }),
  ]);

  if (needsHandoff) {
    await Promise.all([
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { handedOffToHuman: true },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: { stage: "negotiating" },
      }),
    ]);
    logger.info(`Lead ${lead.id} handed off to human`);
  }

  if (sentiment === "hot") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { temperature: "hot" },
    });
  }

  return cleanResponse;
}

function buildSynthesizerPrompt(
  orchestratorBasePrompt: string,
  specialistResults: SpecialistResult[],
): string {
  const specialistSections = specialistResults
    .map(
      (r) =>
        `=== ESPECIALISTA: ${r.specialistName} (${r.specialistType}) ===\n${r.response}`,
    )
    .join("\n\n");

  return `${orchestratorBasePrompt}

━━━ ANÁLISES DOS ESPECIALISTAS ━━━
${specialistSections}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUÇÕES DE SÍNTESE:
- Você recebeu as análises acima dos seus especialistas consultados
- Sintetize as informações em UMA resposta coerente, natural e útil para o cliente
- Mantenha o tom e a persona definidos no seu prompt acima
- Elimine redundâncias e conflitos entre especialistas
- Se qualquer especialista indicou [TRANSBORDO], inclua [TRANSBORDO] na sua resposta
- Responda em português brasileiro de forma conversacional`;
}
