import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type { Lead } from "@prisma/client";
import type { AIProvider } from "../ai/types.js";

interface Extracted {
  name: string | null;
  companyName: string | null;
  city: string | null;
  role: string | null;
  document: string | null; // CNPJ or CPF
}

interface ExtractionResult {
  extracted: Extracted;
  saved: string[];   // field names actually written to DB
  skipped: boolean;  // true when lead already complete
  error?: string;
}

/**
 * Reads the latest conversation turn, extracts lead identification data using
 * a lightweight AI call, and persists any new fields to the lead record.
 *
 * Returns a result object so the caller can log it — never throws.
 */
export async function extractAndUpdateLead(
  lead: Lead,
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  aiProvider: AIProvider,
): Promise<ExtractionResult> {
  const empty: Extracted = { name: null, companyName: null, city: null, role: null, document: null };

  const ctx = lead.context as Record<string, unknown>;
  const alreadyComplete = lead.name && lead.companyName && ctx?.city && ctx?.document;
  if (alreadyComplete) {
    return { extracted: empty, saved: [], skipped: true };
  }

  const recentHistory = history
    .slice(-8)
    .map((h) => `${h.role === "user" ? "Cliente" : "Atendente"}: ${h.content}`)
    .join("\n");

  const conversationBlock = recentHistory
    ? `${recentHistory}\nCliente: ${userMessage}`
    : `Cliente: ${userMessage}`;

  const prompt = `Analise a conversa de WhatsApp abaixo e extraia dados de identificação do CLIENTE (quem está comprando/solicitando), não da empresa atendente.

CONVERSA:
${conversationBlock}

EXEMPLOS de saída esperada:
- Cliente disse "Sou o Carlos, da Construtora ABC, CNPJ 12.345.678/0001-99": {"name":"Carlos","companyName":"Construtora ABC","city":null,"role":null,"document":"12.345.678/0001-99"}
- Cliente disse "João" após ser perguntado o nome: {"name":"João","companyName":null,"city":null,"role":null,"document":null}
- Cliente disse "de Campinas, meu CPF é 123.456.789-00": {"name":null,"companyName":null,"city":"Campinas","role":null,"document":"123.456.789-00"}
- Sem dados identificáveis: {"name":null,"companyName":null,"city":null,"role":null,"document":null}

CAMPOS:
- name: nome próprio que o cliente mencionou para se identificar
- companyName: empresa/negócio DO CLIENTE (não a empresa atendente)
- city: cidade mencionada pelo cliente
- role: cargo ou função do cliente
- document: CNPJ ou CPF mencionado pelo cliente (mantenha a formatação original)

Responda APENAS com JSON válido. Use null sem aspas para campos não encontrados.`;

  try {
    const { response } = await aiProvider.chat({
      systemPrompt: "Você é um extrator preciso de dados estruturados. Retorne apenas JSON válido, sem markdown.",
      history: [],
      userMessage: prompt,
    });

    // Strip markdown code fences if present
    const cleaned = response
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const data = JSON.parse(cleaned) as Partial<Extracted>;

    const extracted: Extracted = {
      name:        typeof data.name        === "string" && data.name.trim()        ? data.name.trim()        : null,
      companyName: typeof data.companyName === "string" && data.companyName.trim() ? data.companyName.trim() : null,
      city:        typeof data.city        === "string" && data.city.trim()        ? data.city.trim()        : null,
      role:        typeof data.role        === "string" && data.role.trim()        ? data.role.trim()        : null,
      document:    typeof data.document    === "string" && data.document.trim()    ? data.document.trim()    : null,
    };

    const dbUpdate: Record<string, unknown> = {};

    if (extracted.name        && !lead.name)        dbUpdate.name        = extracted.name;
    if (extracted.companyName && !lead.companyName) dbUpdate.companyName = extracted.companyName;

    // city, role, and document go into lead.context (no dedicated column)
    const existingCtx = lead.context as Record<string, unknown>;
    const ctxPatch: Record<string, string> = {};
    if (extracted.city     && !existingCtx?.city)     ctxPatch.city     = extracted.city;
    if (extracted.role     && !existingCtx?.role)     ctxPatch.role     = extracted.role;
    if (extracted.document && !existingCtx?.document) ctxPatch.document = extracted.document;
    if (Object.keys(ctxPatch).length > 0) {
      dbUpdate.context = { ...existingCtx, ...ctxPatch };
    }

    const saved = Object.keys(dbUpdate);

    if (saved.length > 0) {
      await prisma.lead.update({ where: { id: lead.id }, data: dbUpdate });
      logger.info("Lead updated via extraction", { leadId: lead.id, saved });
    }

    return { extracted, saved, skipped: false };
  } catch (err) {
    const error = String(err);
    logger.warn("Lead extraction failed", { leadId: lead.id, error });
    return { extracted: empty, saved: [], skipped: false, error };
  }
}
