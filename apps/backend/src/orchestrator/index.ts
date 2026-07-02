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
import { extractAndUpdateLead, type CollectFieldsConfig } from "./lead-extractor.js";
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

  // Parallelize independent DB queries — agents don't need company result
  const [company, allAgents] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: { commercialRules: true },
    }),
    prisma.agent.findMany({ where: { companyId, isActive: true } }),
  ]);

  if (!company || !company.isActive) {
    logger.warn(`Company ${companyId} not found or inactive`);
    return "";
  }

  if (company.tokensUsed >= company.tokenLimit) {
    logger.warn(`Company ${companyId} reached token limit`);
    return "Nosso atendimento está temporariamente indisponível. Por favor, entre em contato pelo telefone.";
  }

  // Lead upsert — needs companyId (from input, not company query)
  const lead = await prisma.lead.upsert({
    where: { companyId_phone: { companyId, phone: from } },
    create: { companyId, phone: from, source: "whatsapp" },
    update: { lastInteractionAt: new Date() },
  });

  let isNewConversation = false;
  let conversation = await prisma.conversation.findFirst({
    where: { companyId, leadId: lead.id, isActive: true },
    include: { currentAgent: true },
  });
  if (!conversation) {
    isNewConversation = true;
    conversation = await prisma.conversation.create({
      data: { companyId, leadId: lead.id },
      include: { currentAgent: true },
    });
  }

  const userText = message.text?.body ?? "";
  const convId = conversation.id;
  const logCtx = { companyId, conversationId: convId, leadPhone: from };

  // Always persist the inbound message and history — even when AI is paused or handed off,
  // so the operator can see the client's messages in the chat view.
  const [, cachedHistoryRaw] = await Promise.all([
    orchLog({ ...logCtx, step: "client_message", actor: `Cliente (${from})`, message: userText }),
    redis.get(`conv:${convId}:history`),
    prisma.message.create({
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
    }),
  ]);

  // After saving the message, bail out if a human is in control
  if (conversation.handedOffToHuman) return "";
  if ((conversation as typeof conversation & { aiPaused?: boolean }).aiPaused) return "";

  const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = cachedHistoryRaw
    ? JSON.parse(cachedHistoryRaw)
    : [];

  // Catch-up: if AI was just resumed after a human-handled pause, load missed messages and build context
  const convCtx = (conversation.context ?? {}) as Record<string, unknown>;
  let catchUpNote = "";
  if (convCtx.aiResumedAt) {
    const pausedAt = convCtx.aiPausedAt as string | undefined;
    if (pausedAt) {
      const pauseMessages = await prisma.message.findMany({
        where: {
          conversationId: convId,
          createdAt: { gte: new Date(pausedAt) },
          NOT: { whatsappMessageId: message.id },
        },
        orderBy: { createdAt: "asc" },
        take: 30,
        select: { direction: true, content: true, sentByUserId: true },
      });

      if (pauseMessages.length > 0) {
        // Append pause messages to Redis history so future AI calls retain them
        for (const m of pauseMessages) {
          history.push({ role: m.direction === "inbound" ? "user" : "assistant", content: m.content });
        }

        // Build an instruction so the AI adapts its tone to match the human operator
        const humanSamples = pauseMessages
          .filter((m) => m.sentByUserId)
          .slice(0, 5)
          .map((m) => `"${m.content.slice(0, 200)}"`)
          .join("\n");

        catchUpNote = `\n\n━━━ IA RETOMANDO APÓS PAUSA ━━━
Enquanto a IA estava pausada, um atendente humano continuou o atendimento. As mensagens dessa conversa já foram adicionadas ao histórico. Adapte seu tom e comunicação para ser consistente com o que foi dito pelo atendente.${humanSamples ? `\nExemplos do estilo do atendente:\n${humanSamples}` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        await orchLog({ ...logCtx, step: "orchestrator", actor: "Sistema", message: `IA retomada após pausa — ${pauseMessages.length} mensagem(s) carregada(s) para contexto` });
      }
    }

    // Clear resume flags — this catch-up only happens once
    const { aiResumedAt: _r, aiPausedAt: _p, ...ctxRest } = convCtx;
    await prisma.conversation.update({ where: { id: convId }, data: { context: JSON.parse(JSON.stringify(ctxRest)) } });
  }

  // Sentiment is a fast keyword check — no await needed, runs sync
  const sentiment = analyzeSentiment(userText);

  // Default provider from company; individual agents may override with their own model
  const defaultProvider = AIProviderFactory.create(company.aiProvider, company.aiModel);
  const agentProvider = (agent: { aiProvider?: string | null; aiModel?: string | null }) =>
    agent.aiProvider && agent.aiModel
      ? AIProviderFactory.create(agent.aiProvider, agent.aiModel)
      : defaultProvider;

  // Keep aiProvider as the company-level default (used for router + synthesis)
  const aiProvider = defaultProvider;

  const orchestratorAgent = allAgents.find((a) => a.type === "orchestrator");

  // Active hours check — if the orchestrator has hours configured and we're outside them, bail early
  if (orchestratorAgent?.activeHoursStart != null && orchestratorAgent?.activeHoursEnd != null) {
    const nowHour = new Date().getUTCHours();
    const start = orchestratorAgent.activeHoursStart;
    const end = orchestratorAgent.activeHoursEnd;
    const inHours = start <= end ? nowHour >= start && nowHour < end : nowHour >= start || nowHour < end;
    if (!inHours) {
      const msg = orchestratorAgent.offHoursMessage ?? "Nosso atendimento está encerrado no momento. Por favor, entre em contato durante o horário comercial.";
      await orchLog({ ...logCtx, step: "orchestrator", actor: "Sistema", message: `Fora do horário (${start}h–${end}h UTC). Retornando mensagem de horário.` });
      return msg;
    }
  }

  // Handoff trigger check — if the user says a trigger word, force handoff immediately
  const lowerText = userText.toLowerCase();
  const triggeredHandoff = orchestratorAgent?.handoffTriggers?.some((t) => lowerText.includes(t.toLowerCase()));

  let specialists = allAgents.filter((a) => a.type !== "orchestrator" && a.scope === "external");
  // Sort specialists by priority descending so higher-priority ones are preferred by the router
  specialists = specialists.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // Filter private specialists — only let through if lead's phone is whitelisted
  const privateIds = specialists.filter((s) => s.isPrivate).map((s) => s.id);
  if (privateIds.length > 0) {
    const allowed = await prisma.agentPhonePermission.findMany({
      where: { agentId: { in: privateIds }, phone: from },
      select: { agentId: true },
    });
    const allowedSet = new Set(allowed.map((p) => p.agentId));
    specialists = specialists.filter((s) => !s.isPrivate || allowedSet.has(s.id));
  }

  // Build specialist manifest so the orchestrator knows what specialists are active for this company
  const specialistManifest = buildSpecialistManifest(specialists);
  // Combined suffix injected into every orchestrator-level system prompt this turn
  const systemSuffix = specialistManifest + catchUpNote;

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

    // 1. Router — determine which specialists to call (or detect out-of-scope)
    const lastSpecialistIds = (convCtx.lastSpecialistIds as string[] | undefined) ?? [];

    await orchLog({ ...logCtx, step: "router", actor: "Router (IA)", message: "Analisando mensagem para selecionar especialistas..." });
    const routerResult = await routeToSpecialists(
      userText,
      specialists,
      aiProvider,
      orchestratorAgent.prompt,
      history.slice(-6),        // recent history for contextual understanding
      lastSpecialistIds,        // sticky: prefer last specialist on follow-up messages
    );

    // Out-of-scope: none of the specialists can handle this topic
    if (routerResult.outOfScope) {
      await orchLog({
        ...logCtx,
        step: "router",
        actor: "Router (IA)",
        message: `Mensagem fora do escopo. Motivo: ${routerResult.outOfScopeReason ?? "tema não relacionado"}`,
        metadata: { outOfScope: true, reason: routerResult.outOfScopeReason },
      });

      const meta = (company.metadata ?? {}) as Record<string, string>;

      if (isGreeting(userText) && meta.mensagemBoasVindas) {
        // Fast path: greeting at start of conversation → send configured welcome message
        finalResponse = meta.mensagemBoasVindas;
      } else {
        // Let the orchestrator respond naturally (handles greetings, off-topic, etc.)
        const agentContext = await buildAgentContext({ company, lead, conversation, agent: orchestratorAgent, sentiment });
        const { response, tokensIn, tokensOut } = await agentProvider(orchestratorAgent).chat({
          systemPrompt: agentContext + systemSuffix,
          history,
          userMessage: userText,
        });
        totalTokensIn += tokensIn;
        totalTokensOut += tokensOut;
        finalResponse = response;
      }
    } else {
      const selectedSpecialists = routerResult.specialists;

      await orchLog({
        ...logCtx,
        step: "router",
        actor: "Router (IA)",
        message: `Especialistas selecionados: ${selectedSpecialists.map((s) => s.name).join(", ")}`,
        metadata: { selected: selectedSpecialists.map((s) => ({ id: s.id, name: s.name })) },
      });

      // Persist active specialists in conversation context for sticky routing on next message
      await prisma.conversation.update({
        where: { id: convId },
        data: {
          context: {
            ...convCtx,
            lastSpecialistIds: selectedSpecialists.map((s) => s.id),
            lastSpecialistNames: selectedSpecialists.map((s) => s.name),
          },
        },
      });

      // 2. Specialists in parallel
      // Optimization: when only 1 specialist, use directMode to skip the synthesizer AI call
      const directMode = selectedSpecialists.length === 1;

      const specialistResults = await runSpecialistsInParallel(selectedSpecialists, {
        company,
        lead,
        conversation,
        userMessage: userText,
        history,
        aiProvider,
        getProvider: agentProvider,
        sentiment,
        directMode,
        catchUpNote,
        onLog: async (name, msg, meta) => {
          await orchLog({ ...logCtx, step: "specialist", actor: `Especialista: ${name}`, message: msg, metadata: meta });
        },
      });

      specialistResults.forEach((r) => {
        totalTokensIn += r.tokensIn;
        totalTokensOut += r.tokensOut;
      });

      if (directMode) {
        // Single specialist responded directly — no synthesizer needed
        finalResponse = specialistResults[0]?.response ?? "";
        await orchLog({
          ...logCtx,
          step: "synthesizer",
          actor: `Especialista: ${selectedSpecialists[0].name}`,
          message: "Resposta direta (sem síntese — especialista único)",
          metadata: { preview: finalResponse.slice(0, 120) },
        });
      } else {
        // 3. Synthesize multiple specialist responses
        await orchLog({ ...logCtx, step: "synthesizer", actor: `Orquestrador: ${orchestratorAgent.name}`, message: "Sintetizando respostas dos especialistas..." });
        const synthPrompt = buildSynthesizerPrompt(orchestratorAgent.prompt, specialistResults) + catchUpNote;
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
      }
    }
  } else if (orchestratorAgent && specialists.length === 0) {
    await orchLog({ ...logCtx, step: "orchestrator", actor: `Orquestrador: ${orchestratorAgent.name}`, message: "Sem especialistas — respondendo diretamente" });
    const agentContext = await buildAgentContext({ company, lead, conversation, agent: orchestratorAgent, sentiment });
    const { response, tokensIn, tokensOut } = await agentProvider(orchestratorAgent).chat({ systemPrompt: agentContext + systemSuffix, history, userMessage: userText });
    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    finalResponse = response;
  } else {
    // Legacy flow (no orchestrator agent configured)
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
    const { response, tokensIn, tokensOut } = await agentProvider(selectedAgent).chat({ systemPrompt: agentContext, history, userMessage: userText });
    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    finalResponse = response;
  }

  // If a handoff trigger word was found in the user's message, force handoff
  if (triggeredHandoff) finalResponse += " [TRANSBORDO]";

  const needsHandoff = finalResponse.includes("[TRANSBORDO]");
  let cleanResponse = finalResponse.replace("[TRANSBORDO]", "").trim();
  if (needsHandoff && orchestratorAgent?.fallbackMessage) {
    cleanResponse = orchestratorAgent.fallbackMessage;
  }

  // Prepend initial message on first contact
  if (isNewConversation && orchestratorAgent?.initialMessage) {
    cleanResponse = `${orchestratorAgent.initialMessage}\n\n${cleanResponse}`;
  }

  history.push({ role: "user", content: userText });
  history.push({ role: "assistant", content: cleanResponse });
  await redis.setex(`conv:${convId}:history`, 86400, JSON.stringify(history.slice(-20)));

  const totalTokens = totalTokensIn + totalTokensOut;

  // Find the attendance (identifier) agent to pass its collectFields to the extractor
  const identifierAgent = allAgents.find((a) => a.type === "attendance");
  const collectFields = identifierAgent?.collectFields as CollectFieldsConfig | null | undefined;

  // Run extraction concurrently with DB saves — both happen after response is built
  const [extractionResult] = await Promise.all([
    extractAndUpdateLead(lead, userText, history, aiProvider, collectFields),
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
    prisma.conversation.update({ where: { id: convId }, data: { totalTokensUsed: { increment: totalTokens } } }),
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

  // Log extraction result so it's visible in the orchestration log UI
  if (!extractionResult.skipped) {
    await orchLog({
      ...logCtx,
      step: "orchestrator",
      actor: "Extrator de Lead",
      message: extractionResult.error
        ? `Falha na extração: ${extractionResult.error}`
        : extractionResult.saved.length > 0
          ? `Lead atualizado — campos: ${extractionResult.saved.join(", ")} | extraído: ${JSON.stringify(extractionResult.extracted)}`
          : `Nenhum dado identificável nesta mensagem | extraído: ${JSON.stringify(extractionResult.extracted)}`,
      metadata: { extracted: extractionResult.extracted, saved: extractionResult.saved },
    });
  }

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

  // Response delay: simulate typing before returning (controlled per orchestrator agent)
  const delayMs = orchestratorAgent?.responseDelayMs ?? 0;
  if (delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

  return cleanResponse;
}

function buildSpecialistManifest(specialists: Awaited<ReturnType<typeof prisma.agent.findMany>>): string {
  if (specialists.length === 0) return "";
  const lines = specialists.map((s) => {
    const kws = (s.triggerKeywords as string[]).join(", ") || "—";
    const desc = s.description ? ` — ${s.description.slice(0, 80)}` : "";
    return `• ${s.name} [${s.type}]${desc} | palavras-chave: ${kws}`;
  });
  return `\n\n━━━ ESPECIALISTAS DISPONÍVEIS NESTA EMPRESA ━━━\n${lines.join("\n")}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

const GREETING_RE = /^(oi|olá|ola|bom\s*dia|boa\s*tarde|boa\s*noite|tudo\s*(bem|bom|certo|ótimo|otimo)|como\s*(vai|você|voce)|hey|hello|hi|e\s*a[íi]|salve|opa|eae|eai)\b/i;

/** Returns true if the message is a short social greeting with no product query. */
function isGreeting(text: string): boolean {
  const t = text.trim();
  return t.length <= 80 && GREETING_RE.test(t);
}

function buildSynthesizerPrompt(orchestratorBasePrompt: string, specialistResults: SpecialistResult[]): string {
  const sections = specialistResults
    .map((r) => {
      const isQuoter = r.specialistType === "quoter";
      const header = `=== ESPECIALISTA: ${r.specialistName} (${r.specialistType}) ===`;
      const note = isQuoter ? "\n[AÇÃO JÁ EXECUTADA — esta resposta descreve algo que já foi feito, use-a como base]" : "";
      return `${header}${note}\n${r.response}`;
    })
    .join("\n\n");

  // If the quoter ran and succeeded, add a hard constraint so other specialists can't contradict it
  const quoterResult = specialistResults.find((r) => r.specialistType === "quoter");
  const quoterSucceeded = quoterResult && quoterResult.response.includes("✅ Orçamento");
  const quoterConstraint = quoterSucceeded
    ? "\n- CRÍTICO: O Orçamentista já gerou e enviou o PDF do orçamento (ação consumada). Baseie sua síntese na resposta dele. NUNCA diga frases como 'não consigo gerar PDF', 'vou encaminhar ao time' ou 'pode me confirmar seu e-mail' — o PDF já foi enviado."
    : "";

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
- FORMATO OBRIGATÓRIO: escreva UMA frase por vez, terminando cada frase com ponto, exclamação ou interrogação antes de começar a próxima. Não use listas com traços ou asteriscos. Cada ideia nova em uma frase nova.${quoterConstraint}`;
}
