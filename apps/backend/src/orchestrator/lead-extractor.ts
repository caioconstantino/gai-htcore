import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type { Lead } from "@prisma/client";
import type { AIProvider } from "../ai/types.js";

interface Extracted {
  name?: string | null;
  companyName?: string | null;
  city?: string | null;
  role?: string | null;
}

/**
 * Silently extracts lead data (name, company, city, role) from the conversation
 * using a lightweight AI call and persists any new fields to the lead record.
 *
 * Never throws — failure is logged and swallowed so the main flow is unaffected.
 * Skip if lead already has both name and companyName (nothing left to infer).
 */
export async function extractAndUpdateLead(
  lead: Lead,
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  aiProvider: AIProvider,
): Promise<void> {
  if (lead.name && lead.companyName) return;

  const recentHistory = history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "Cliente" : "Assistente"}: ${h.content}`)
    .join("\n");

  const prompt = `Analise a conversa e extraia dados do CLIENTE (não da empresa que atende).

CONVERSA:
${recentHistory ? recentHistory + "\n" : ""}Cliente: ${userMessage}

Retorne APENAS JSON válido sem texto adicional:
{"name":null,"companyName":null,"city":null,"role":null}

REGRAS:
- name: primeiro nome ou nome completo que o cliente usou para se identificar (null se não mencionou)
- companyName: empresa/negócio DO CLIENTE (null se não mencionou)
- city: cidade mencionada pelo cliente (null se não mencionou)
- role: cargo ou função do cliente (null se não mencionou)
- Nunca invente dados — prefira null a incerteza`;

  try {
    const { response } = await aiProvider.chat({
      systemPrompt: "Você é um extrator de dados. Retorne apenas JSON válido.",
      history: [],
      userMessage: prompt,
    });

    const cleaned = response.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const data = JSON.parse(cleaned) as Extracted;

    const nameVal = data.name?.trim() || null;
    const companyVal = data.companyName?.trim() || null;
    const cityVal = data.city?.trim() || null;
    const roleVal = data.role?.trim() || null;

    const dbUpdate: Record<string, unknown> = {};
    if (nameVal && !lead.name) dbUpdate.name = nameVal;
    if (companyVal && !lead.companyName) dbUpdate.companyName = companyVal;

    // Extra fields without a dedicated column go into lead.context JSON
    const ctxPatch: Record<string, string> = {};
    if (cityVal) ctxPatch.city = cityVal;
    if (roleVal) ctxPatch.role = roleVal;

    if (Object.keys(ctxPatch).length > 0) {
      dbUpdate.context = { ...(lead.context as Record<string, unknown>), ...ctxPatch };
    }

    if (Object.keys(dbUpdate).length === 0) return;

    await prisma.lead.update({ where: { id: lead.id }, data: dbUpdate });

    logger.info("Lead updated via extraction", {
      leadId: lead.id,
      fields: Object.keys(dbUpdate),
    });
  } catch (err) {
    logger.warn("Lead extraction skipped", { leadId: lead.id, reason: String(err) });
  }
}
