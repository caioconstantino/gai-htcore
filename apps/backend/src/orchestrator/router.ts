import type { Agent } from "@prisma/client";
import type { AIProvider } from "../ai/types.js";
import { logger } from "../lib/logger.js";

/**
 * Uses AI to determine which specialist agents should be consulted for a given message.
 * Returns all specialists when only one exists (no routing needed).
 */
export async function routeToSpecialists(
  userMessage: string,
  specialists: Agent[],
  aiProvider: AIProvider,
): Promise<Agent[]> {
  if (specialists.length === 0) return [];
  if (specialists.length === 1) return specialists;

  const specialistList = specialists
    .map(
      (a) =>
        `- id: "${a.id}" | nome: "${a.name}" | tipo: "${a.type}" | keywords: [${(a.triggerKeywords as string[]).join(", ")}]`,
    )
    .join("\n");

  const routerPrompt = `Você é um roteador de agentes. Sua única função é decidir quais especialistas devem ser consultados para responder a mensagem do cliente.

ESPECIALISTAS DISPONÍVEIS:
${specialistList}

REGRAS:
- Selecione 1 ou mais especialistas relevantes para a mensagem
- Sempre inclua o agente "commercial" ou equivalente quando houver dúvida de intenção de compra/locação
- Responda SOMENTE com JSON válido, sem texto adicional

FORMATO OBRIGATÓRIO:
{"specialists": ["id1", "id2"]}`;

  try {
    const { response } = await aiProvider.chat({
      systemPrompt: routerPrompt,
      history: [],
      userMessage: `Mensagem do cliente: "${userMessage}"`,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in router response");

    const parsed = JSON.parse(jsonMatch[0]) as { specialists?: string[] };
    const selectedIds = parsed.specialists ?? [];

    const selected = specialists.filter((a) => selectedIds.includes(a.id));
    if (selected.length === 0) {
      logger.warn("Router returned no valid specialists, using all", { response });
      return specialists;
    }

    logger.info("Router selected specialists", {
      selected: selected.map((a) => a.name),
      userMessage: userMessage.slice(0, 60),
    });

    return selected;
  } catch (err) {
    logger.warn("Router failed, falling back to all specialists", { err });
    return specialists;
  }
}
