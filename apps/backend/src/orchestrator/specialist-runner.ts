import type { Agent, Company, Lead, Conversation } from "@prisma/client";
import type { AIProvider, ChatMessage } from "../ai/types.js";
import { buildAgentContext } from "./context.js";
import { logger } from "../lib/logger.js";

export interface SpecialistResult {
  specialistId: string;
  specialistName: string;
  specialistType: string;
  response: string;
  tokensIn: number;
  tokensOut: number;
}

/**
 * Runs a specialist agent and returns their expert analysis to the orchestrator.
 * Specialists respond from their domain expertise — the orchestrator synthesizes.
 */
export async function runSpecialist(input: {
  specialist: Agent;
  company: Company & { commercialRules: unknown };
  lead: Lead;
  conversation: Conversation;
  userMessage: string;
  history: ChatMessage[];
  aiProvider: AIProvider;
  sentiment: string;
}): Promise<SpecialistResult> {
  const { specialist, company, lead, conversation, userMessage, history, aiProvider, sentiment } = input;

  const baseContext = await buildAgentContext({
    company: company as Parameters<typeof buildAgentContext>[0]["company"],
    lead,
    conversation,
    agent: specialist,
    sentiment,
  });

  const specialistPrompt = `${baseContext}

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

    logger.debug(`Specialist "${specialist.name}" responded`, {
      tokens: tokensIn + tokensOut,
      preview: response.slice(0, 80),
    });

    return {
      specialistId: specialist.id,
      specialistName: specialist.name,
      specialistType: specialist.type,
      response,
      tokensIn,
      tokensOut,
    };
  } catch (err) {
    logger.error(`Specialist "${specialist.name}" failed`, { err });
    return {
      specialistId: specialist.id,
      specialistName: specialist.name,
      specialistType: specialist.type,
      response: "",
      tokensIn: 0,
      tokensOut: 0,
    };
  }
}

/**
 * Runs all specialists in parallel and returns their combined results.
 */
export async function runSpecialistsInParallel(
  specialists: Agent[],
  input: Omit<Parameters<typeof runSpecialist>[0], "specialist">,
): Promise<SpecialistResult[]> {
  const results = await Promise.all(
    specialists.map((specialist) => runSpecialist({ ...input, specialist })),
  );
  return results.filter((r) => r.response.length > 0);
}
