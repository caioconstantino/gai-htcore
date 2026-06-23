import type { Agent } from "@prisma/client";
import type { AIProvider } from "../ai/types.js";
import { logger } from "../lib/logger.js";

export interface RouterResult {
  specialists: Agent[];
  outOfScope: boolean;
  outOfScopeReason?: string;
}

/**
 * Uses AI to determine which specialists should handle the message.
 * Also detects when the message is completely outside the agents' scope.
 * Returns all specialists as fallback on parse errors.
 *
 * @param orchestratorInstructions - The orchestrator agent's prompt, included in the
 *   router context so company-specific routing rules ("andaime → PAINEL TUBULAR") are respected.
 */
export async function routeToSpecialists(
  userMessage: string,
  specialists: Agent[],
  aiProvider: AIProvider,
  orchestratorInstructions?: string,
): Promise<RouterResult> {
  if (specialists.length === 0) return { specialists: [], outOfScope: false };
  // Single specialist — no routing needed, but still check if out of scope
  if (specialists.length === 1) {
    return outOfScopeCheck(userMessage, specialists, aiProvider);
  }

  // ── Keyword pre-match (multi-specialist) ─────────────────────────
  // If exactly one specialist has a keyword hit, route directly — no AI call needed.
  // If multiple hit, pass only those candidates to the AI to decide.
  const lower = userMessage.toLowerCase();
  const keywordMatches = specialists.filter((s) => {
    const kws = (s.triggerKeywords as string[]) ?? [];
    return kws.length > 0 && kws.some((k) => lower.includes(k.toLowerCase()));
  });

  if (keywordMatches.length === 1) {
    logger.info("Router: single keyword match, skipping AI", { matched: keywordMatches[0].name, userMessage: userMessage.slice(0, 60) });
    return { specialists: keywordMatches, outOfScope: false };
  }

  // Use matched subset as candidates if any, otherwise use all
  const candidates = keywordMatches.length > 1 ? keywordMatches : specialists;

  const specialistList = candidates
    .map(
      (a) =>
        `- id: "${a.id}" | nome: "${a.name}" | tipo: "${a.type}" | keywords: [${(a.triggerKeywords as string[]).join(", ")}]`,
    )
    .join("\n");

  // Include orchestrator routing rules so company-specific logic is respected
  const orchestratorContext = orchestratorInstructions
    ? `\nREGRAS DE ROTEAMENTO DO ORQUESTRADOR (seguir com prioridade máxima):\n${orchestratorInstructions.slice(0, 1000)}\n`
    : "";

  const routerPrompt = `Você é um roteador de agentes. Sua única função é decidir quais especialistas devem ser consultados para responder a mensagem do cliente.

ESPECIALISTAS DISPONÍVEIS:
${specialistList}
${orchestratorContext}
REGRAS GERAIS:
- Se a mensagem for completamente fora do escopo de TODOS os especialistas, retorne specialists vazio e outOfScope: true com uma razão curta
- Selecione 1 ou mais especialistas relevantes quando a mensagem for relacionada ao escopo
- Em caso de dúvida, prefira incluir o especialista a rejeitar — falsos negativos são piores que falsos positivos
- Responda SOMENTE com JSON válido, sem texto adicional

FORMATO — dentro do escopo:
{"specialists": ["id1", "id2"], "outOfScope": false}

FORMATO — fora do escopo:
{"specialists": [], "outOfScope": true, "reason": "breve motivo em português"}`;

  try {
    const { response } = await aiProvider.chat({
      systemPrompt: routerPrompt,
      history: [],
      userMessage: `Mensagem do cliente: "${userMessage}"`,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in router response");

    const parsed = JSON.parse(jsonMatch[0]) as {
      specialists?: string[];
      outOfScope?: boolean;
      reason?: string;
    };

    if (parsed.outOfScope) {
      logger.info("Router: message out of scope", { reason: parsed.reason, userMessage: userMessage.slice(0, 80) });
      return { specialists: [], outOfScope: true, outOfScopeReason: parsed.reason };
    }

    const selectedIds = parsed.specialists ?? [];
    const selected = specialists.filter((a) => selectedIds.includes(a.id));

    if (selected.length === 0) {
      logger.warn("Router returned no valid specialists, using all", { response });
      return { specialists, outOfScope: false };
    }

    logger.info("Router selected specialists", {
      selected: selected.map((a) => a.name),
      userMessage: userMessage.slice(0, 60),
    });

    return { specialists: selected, outOfScope: false };
  } catch (err) {
    logger.warn("Router failed, falling back to all specialists", { err });
    return { specialists, outOfScope: false };
  }
}

/**
 * Fast out-of-scope check for when there's only one specialist.
 * Uses keywords first to avoid an AI call when clearly in-scope.
 */
async function outOfScopeCheck(
  userMessage: string,
  specialists: Agent[],
  aiProvider: AIProvider,
): Promise<RouterResult> {
  const spec = specialists[0];
  const keywords = (spec.triggerKeywords as string[]) ?? [];

  // Quick keyword check — if any keyword matches, skip the AI call
  const lower = userMessage.toLowerCase();
  const hasKeywordMatch = keywords.some((k) => lower.includes(k.toLowerCase()));
  if (hasKeywordMatch || keywords.length === 0) {
    return { specialists, outOfScope: false };
  }

  // AI check only when no keyword matches
  const checkPrompt = `Você é um verificador de escopo. Analise se a mensagem do cliente está relacionada ao escopo do especialista abaixo.

ESPECIALISTA: ${spec.name}
TIPO: ${spec.type}
KEYWORDS DO ESCOPO: ${keywords.join(", ")}
PROMPT RESUMIDO: ${(spec.prompt ?? "").slice(0, 300)}

Responda SOMENTE com JSON:
{"inScope": true} ou {"inScope": false, "reason": "motivo curto"}`;

  try {
    const { response } = await aiProvider.chat({
      systemPrompt: checkPrompt,
      history: [],
      userMessage: `Mensagem do cliente: "${userMessage}"`,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { specialists, outOfScope: false };

    const parsed = JSON.parse(jsonMatch[0]) as { inScope?: boolean; reason?: string };

    if (parsed.inScope === false) {
      logger.info("Out-of-scope check: message not in scope", { reason: parsed.reason });
      return { specialists: [], outOfScope: true, outOfScopeReason: parsed.reason };
    }
  } catch {
    // On error, assume in scope to avoid false negatives
  }

  return { specialists, outOfScope: false };
}
