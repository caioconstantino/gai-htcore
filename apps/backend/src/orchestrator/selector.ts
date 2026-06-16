import type { Agent } from "@prisma/client";
import { logger } from "../lib/logger.js";

interface SelectorInput {
  userMessage: string;
  currentAgentId?: string;
  agents: Agent[];
  context: Record<string, unknown>;
}

export async function selectAgent(input: SelectorInput): Promise<Agent | null> {
  const { userMessage, currentAgentId, agents, context } = input;

  if (agents.length === 0) return null;

  const messageLower = userMessage.toLowerCase();

  // Verifica se algum agente tem keyword match
  for (const agent of agents) {
    const keywords = agent.triggerKeywords as string[];
    if (keywords.some((kw) => messageLower.includes(kw.toLowerCase()))) {
      logger.debug(`Agent selected by keyword: ${agent.name}`);
      return agent;
    }
  }

  // Mantém agente atual se já estava em atendimento e não há keyword match
  if (currentAgentId) {
    const current = agents.find((a) => a.id === currentAgentId);
    if (current) {
      logger.debug(`Keeping current agent: ${current.name}`);
      return current;
    }
  }

  // Fallback: agente de atendimento geral
  const fallback =
    agents.find((a) => a.type === "attendance") ?? agents[0] ?? null;

  logger.debug(`Fallback agent: ${fallback?.name}`);
  return fallback;
}
