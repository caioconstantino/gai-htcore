import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { AIProviderFactory } from "../ai/factory.js";
import { buildAgentContext } from "./context.js";
import { selectAgent } from "./selector.js";
import { analyzeSentiment } from "./sentiment.js";
import { routeToSpecialists } from "./router.js";
import { runSpecialistsInParallel } from "./specialist-runner.js";
import { orchLog } from "./orch-logger.js";
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
  const convId = conversation.id;

  const logCtx = { companyId, conversationId: convId, leadPhone: from };

  await orchLog({ ...logCtx, step: "client_message", actor: `Cliente (${from})`, message: userText });

  await prisma.message.create({
    data: {
      companyId,
      leadId: lead.id,
      conversationId: convId,
      direction: "inbound",
      content: userText,
      type: "text",
      whatsappMessageId: message.id,
      status: "delivered",
    },
  });

  const cacheKey = `conv:${convId}:history`;
  const cachedHistory = await redis.get(cacheKey);
  const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = cachedHistory
    ? JSON.parse(cachedHistory)
    : [];

  const sentiment = await analyzeSentiment(userText);
  const aiProvider = AIProviderFactory.create(company.aiProvider, company.aiModel);

  const allAgents = await prisma.agent.findMany({ where: { companyId, isActive: true } });
  const orchestratorAgent = allAgents.find((a) => a.type === "orchestrator");
  const specialists = allAgents.filter((a) => a.type !== "orchestrator" && a.scope === "external");

  let finalResponse: string;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let primaryAgentId: string | null = orchestratorAgent?.id ?? null;

  if (orchestratorAgent && specialists.length > 0) {
    await orchLog({
      ...logCtx,
      step: "orchestrator",
      actor: `Orquestrador: ${orchestratorAgent.name}`,
      message: `Fluxo multi-agente iniciado — ${specialists.length} especialista(s) disponível(is)`,
      metadata: { specialists: specialists.map((s) => s.name) },
    });

    // 1. Router
    await orchLog({ ...logCtx, step: "router", actor: "Router (IA)", message: "Analisando mensagem para selecionar especialistas..." });
    const selectedSpecialists = await routeToSpecialists(userText, specialists, aiProvider);
    await orchLog({
      ...logCtx,
      step: "router",
      actor: "Router (IA)",
      message: `Especialistas selecionados: ${selectedSpecialists.map((s) => s.name).join(", ")}`,
      metadata: { selected: selectedSpecialists.map((s) => ({ id: s.id, name: s.name })) },
    });

    // 2. Especialistas em paralelo
    const specialistResults = await runSpecialistsInParallel(selectedSpecialists, {
      company,
      lead,
      conversation,
      userMessage: userText,
      history,
      aiProvider,
      sentiment,
      onLog: async (name, msg, meta) => {
        await orchLog({ ...logCtx, step: "specialist", actor: `Especialista: ${name}`, message: msg, metadata: meta });
      },
    });

    specialistResults.forEach((r) => {
      totalTokensIn += r.tokensIn;
      totalTokensOut += r.tokensOut;
    });

    // 3. Síntese
    await orchLog({ ...logCtx, step: "synthesizer", actor: `Orquestrador: ${orchestratorAgent.name}`, message: "Sintetizando respostas dos especialistas..." });
    const synthPrompt = buildSynthesizerPrompt(orchestratorAgent.prompt, specialistResults);
    const { response, tokensIn, tokensOut } = await aiProvider.chat({ systemPrompt: synthPrompt, history, userMessage: userText });
    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    finalResponse = response;

    await orchLog({
      ...logCtx,
      step: "synthesizer",
      actor: `Orquestrador: ${orchestratorAgent.name}`,
      message: "Resposta sintetizada pronta",
      metadata: { tokensIn, tokensOut, preview: response.slice(0, 120) },
    });
  } else if (orchestratorAgent && specialists.length === 0) {
    await orchLog({ ...logCtx, step: "orchestrator", actor: `Orquestrador: ${orchestratorAgent.name}`, message: "Sem especialistas — respondendo diretamente" });
    const agentContext = await buildAgentContext({ company, lead, conversation, agent: orchestratorAgent, sentiment });
    const { response, tokensIn, tokensOut } = await aiProvider.chat({ systemPrompt: agentContext, history, userMessage: userText });
    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    finalResponse = response;
  } else {
    // Fluxo legado
    const selectedAgent = await selectAgent({
      userMessage: userText,
      currentAgentId: conversation.currentAgentId ?? undefined,
      agents: specialists.length > 0 ? specialists : allAgents,
      context: conversation.context as Record<string, unknown>,
    });

    if (!selectedAgent) return "Olá! Como posso te ajudar hoje?";
    primaryAgentId = selectedAgent.id;

    await orchLog({ ...logCtx, step: "orchestrator", actor: `Agente: ${selectedAgent.name}`, message: "Fluxo legado — agente selecionado por keywords" });

    if (conversation.currentAgentId !== selectedAgent.id) {
      await prisma.conversation.update({ where: { id: convId }, data: { currentAgentId: selectedAgent.id } });
    }

    const agentContext = await buildAgentContext({ company, lead, conversation, agent: selectedAgent, sentiment });
    const { response, tokensIn, tokensOut } = await aiProvider.chat({ systemPrompt: agentContext, history, userMessage: userText });
    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    finalResponse = response;
  }

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
        conversationId: convId,
        direction: "outbound",
        content: cleanResponse,
        type: "text",
        agentId: primaryAgentId,
        status: "pending",
        tokensUsed: totalTokens,
      },
    }),
    prisma.company.update({ where: { id: companyId }, data: { tokensUsed: { increment: totalTokens } } }),
    prisma.tokenUsageLog.create({
      data: {
        companyId,
        agentId: primaryAgentId,
        conversationId: convId,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        totalTokens,
        model: company.aiModel,
      },
    }),
    orchLog({
      ...logCtx,
      step: "send",
      actor: "Sistema",
      message: cleanResponse,
      metadata: { totalTokens, needsHandoff },
    }),
  ]);

  if (needsHandoff) {
    await Promise.all([
      prisma.conversation.update({ where: { id: convId }, data: { handedOffToHuman: true } }),
      prisma.lead.update({ where: { id: lead.id }, data: { stage: "negotiating" } }),
    ]);
    logger.info(`Lead ${lead.id} handed off to human`);
  }

  if (sentiment === "hot") {
    await prisma.lead.update({ where: { id: lead.id }, data: { temperature: "hot" } });
  }

  return cleanResponse;
}

function buildSynthesizerPrompt(orchestratorBasePrompt: string, specialistResults: SpecialistResult[]): string {
  const sections = specialistResults
    .map((r) => `=== ESPECIALISTA: ${r.specialistName} (${r.specialistType}) ===\n${r.response}`)
    .join("\n\n");

  return `${orchestratorBasePrompt}

━━━ ANÁLISES DOS ESPECIALISTAS ━━━
${sections}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUÇÕES DE SÍNTESE:
- Sintetize as informações em UMA resposta coerente, natural e útil para o cliente
- Mantenha o tom e a persona definidos no seu prompt acima
- Elimine redundâncias e conflitos entre especialistas
- Se qualquer especialista indicou [TRANSBORDO], inclua [TRANSBORDO] na sua resposta
- Responda em português brasileiro de forma conversacional
- FORMATO OBRIGATÓRIO: escreva UMA frase por vez, terminando cada frase com ponto, exclamação ou interrogação antes de começar a próxima. Não use listas com traços ou asteriscos. Cada ideia nova em uma frase nova.`;
}
