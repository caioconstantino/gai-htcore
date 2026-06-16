import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { AIProviderFactory } from "../ai/factory.js";
import { buildAgentContext } from "./context.js";
import { selectAgent } from "./selector.js";
import { analyzeSentiment } from "./sentiment.js";
import type { WhatsAppMessage } from "../types.js";

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

  // Controle de tokens
  if (company.tokensUsed >= company.tokenLimit) {
    logger.warn(`Company ${companyId} reached token limit`);
    return "Nosso atendimento está temporariamente indisponível. Por favor, entre em contato pelo telefone.";
  }

  // Busca ou cria o lead
  let lead = await prisma.lead.upsert({
    where: { companyId_phone: { companyId, phone: from } },
    create: { companyId, phone: from, source: "whatsapp" },
    update: { lastInteractionAt: new Date() },
  });

  // Busca ou cria conversa ativa
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

  // Se já transferido para humano, ignora
  if (conversation.handedOffToHuman) return "";

  // Salva mensagem recebida
  await prisma.message.create({
    data: {
      companyId,
      leadId: lead.id,
      conversationId: conversation.id,
      direction: "inbound",
      content: message.text?.body ?? "",
      type: "text",
      whatsappMessageId: message.id,
      status: "delivered",
    },
  });

  // Busca histórico de mensagens do Redis (cache rápido)
  const cacheKey = `conv:${conversation.id}:history`;
  const cachedHistory = await redis.get(cacheKey);
  const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = cachedHistory
    ? JSON.parse(cachedHistory)
    : [];

  const userText = message.text?.body ?? "";

  // Análise de sentimento para priorização
  const sentiment = await analyzeSentiment(userText);

  // Seleciona o agente correto
  const agents = await prisma.agent.findMany({
    where: { companyId, isActive: true, scope: "external" },
  });

  const selectedAgent = await selectAgent({
    userMessage: userText,
    currentAgentId: conversation.currentAgentId ?? undefined,
    agents,
    context: conversation.context as Record<string, unknown>,
  });

  if (!selectedAgent) {
    return "Olá! Como posso te ajudar hoje?";
  }

  // Atualiza agente na conversa se mudou
  if (conversation.currentAgentId !== selectedAgent.id) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { currentAgentId: selectedAgent.id },
    });
  }

  // Monta contexto completo para o agente
  const agentContext = await buildAgentContext({
    company,
    lead,
    conversation,
    agent: selectedAgent,
    sentiment,
  });

  // Chama o motor de IA
  const aiProvider = AIProviderFactory.create(company.aiProvider, company.aiModel);

  const { response, tokensIn, tokensOut } = await aiProvider.chat({
    systemPrompt: agentContext,
    history,
    userMessage: userText,
  });

  // Detecta transbordo para humano
  const needsHandoff = response.includes("[TRANSBORDO]");
  const cleanResponse = response.replace("[TRANSBORDO]", "").trim();

  // Atualiza histórico no Redis (TTL 24h)
  history.push({ role: "user", content: userText });
  history.push({ role: "assistant", content: cleanResponse });
  await redis.setex(cacheKey, 86400, JSON.stringify(history.slice(-20)));

  // Salva tokens e atualiza contadores
  const totalTokens = tokensIn + tokensOut;
  await Promise.all([
    prisma.message.create({
      data: {
        companyId,
        leadId: lead.id,
        conversationId: conversation.id,
        direction: "outbound",
        content: cleanResponse,
        type: "text",
        agentId: selectedAgent.id,
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
        agentId: selectedAgent.id,
        conversationId: conversation.id,
        tokensIn,
        tokensOut,
        totalTokens,
        model: company.aiModel,
      },
    }),
  ]);

  // Transbordo: marca conversa e atualiza lead
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

  // Atualiza temperatura do lead com base no sentimento
  if (sentiment === "hot") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { temperature: "hot" },
    });
  }

  return cleanResponse;
}
