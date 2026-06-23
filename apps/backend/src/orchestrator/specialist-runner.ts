import type { Agent, Company, Lead, Conversation } from "@prisma/client";
import type { AIProvider, ChatMessage } from "../ai/types.js";
import { buildAgentContext } from "./context.js";
import { logger } from "../lib/logger.js";
import { runQuoterAgent } from "./quoter.js";

export interface SpecialistResult {
  specialistId: string;
  specialistName: string;
  specialistType: string;
  response: string;
  tokensIn: number;
  tokensOut: number;
}

type OnLog = (name: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;

export async function runSpecialist(input: {
  specialist: Agent;
  company: Company & { commercialRules: unknown };
  lead: Lead;
  conversation: Conversation;
  userMessage: string;
  history: ChatMessage[];
  aiProvider: AIProvider;
  /** If provided, overrides aiProvider for this specific specialist's model. */
  getProvider?: (agent: Agent) => AIProvider;
  sentiment: string;
  onLog?: OnLog;
  /**
   * When true, the specialist responds directly to the client (no synthesizer needed).
   * Use when only one specialist is selected — saves one AI round-trip.
   */
  directMode?: boolean;
}): Promise<SpecialistResult> {
  const { specialist, company, lead, conversation, userMessage, history, sentiment, onLog, directMode } = input;
  const aiProvider = input.getProvider ? input.getProvider(specialist) : input.aiProvider;

  // Quoter agents have a dedicated flow: extract items from history, generate PDF, send via WhatsApp
  if (specialist.type === "quoter") {
    return runQuoterAgent({ specialist, company, lead, conversation, userMessage, history, aiProvider, getProvider: input.getProvider, sentiment, onLog, directMode });
  }

  await onLog?.(specialist.name, directMode ? "Respondendo diretamente ao cliente..." : "Consultado pelo orquestrador — analisando...");

  const baseContext = await buildAgentContext({
    company: company as Parameters<typeof buildAgentContext>[0]["company"],
    lead,
    conversation,
    agent: specialist,
    sentiment,
  });

  const specialistPrompt = directMode
    ? baseContext
    : `${baseContext}

---
MODO ESPECIALISTA: Você está sendo consultado pelo agente orquestrador, NÃO pelo cliente diretamente.
Forneça sua análise e recomendação de resposta para o orquestrador sintetizar.
- Seja direto e objetivo
- Inclua as informações relevantes da sua área de especialidade
- Se houver necessidade de transbordo para humano, inclua a tag [TRANSBORDO]
- Não use saudações ou despedidas — apenas sua análise especializada`;

  try {
    const { response, tokensIn, tokensOut } = await aiProvider.chat({
      systemPrompt: specialistPrompt,
      history,
      userMessage,
    });

    logger.debug(`Specialist "${specialist.name}" responded`, { tokens: tokensIn + tokensOut, directMode });
    await onLog?.(specialist.name, response, { tokensIn, tokensOut });

    return { specialistId: specialist.id, specialistName: specialist.name, specialistType: specialist.type, response, tokensIn, tokensOut };
  } catch (err) {
    logger.error(`Specialist "${specialist.name}" failed`, { err });
    await onLog?.(specialist.name, `Erro: ${(err as Error).message}`, { error: true });
    return { specialistId: specialist.id, specialistName: specialist.name, specialistType: specialist.type, response: "", tokensIn: 0, tokensOut: 0 };
  }
}

export async function runSpecialistsInParallel(
  specialists: Agent[],
  input: Omit<Parameters<typeof runSpecialist>[0], "specialist">,
): Promise<SpecialistResult[]> {
  const results = await Promise.all(specialists.map((specialist) => runSpecialist({ ...input, specialist })));
  return results.filter((r) => r.response.length > 0);
}
