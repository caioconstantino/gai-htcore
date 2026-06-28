import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type { Lead } from "@prisma/client";
import type { AIProvider } from "../ai/types.js";

export interface CollectFieldsConfig {
  standard: string[];
  custom: Array<{ key: string; label: string; description?: string }>;
}

interface Extracted {
  name: string | null;
  companyName: string | null;
  city: string | null;
  role: string | null;
  document: string | null; // CNPJ or CPF
  [key: string]: string | null; // custom fields
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
// Default fields extracted when no collectFields config is present
const DEFAULT_STANDARD = ["name", "companyName", "city", "document"];

export async function extractAndUpdateLead(
  lead: Lead,
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  aiProvider: AIProvider,
  collectFields?: CollectFieldsConfig | null,
): Promise<ExtractionResult> {
  const empty: Extracted = { name: null, companyName: null, city: null, role: null, document: null };

  const standardFields = collectFields?.standard ?? DEFAULT_STANDARD;
  const customFields   = collectFields?.custom   ?? [];

  // Skip if all configured standard fields and custom fields are already filled
  const existingCtx = lead.context as Record<string, unknown>;
  const standardDone = standardFields.every((key) => {
    const direct = (lead as Record<string, unknown>)[key];
    return typeof direct === "string" && (direct as string).trim();
  });
  const customDone = customFields.every((f) => {
    const v = existingCtx?.[f.key];
    return typeof v === "string" && (v as string).trim();
  });
  if (standardDone && customDone) {
    return { extracted: empty, saved: [], skipped: true };
  }

  const recentHistory = history
    .slice(-8)
    .map((h) => `${h.role === "user" ? "Cliente" : "Atendente"}: ${h.content}`)
    .join("\n");

  const conversationBlock = recentHistory
    ? `${recentHistory}\nCliente: ${userMessage}`
    : `Cliente: ${userMessage}`;

  const standardFieldDescriptions: Record<string, string> = {
    name:         "nome próprio que o cliente mencionou para se identificar",
    companyName:  "empresa/negócio DO CLIENTE (não a empresa atendente)",
    city:         "cidade mencionada pelo cliente",
    state:        "estado ou UF mencionado pelo cliente",
    document:     "CNPJ ou CPF mencionado pelo cliente (mantenha a formatação original)",
    address:      "endereço ou rua mencionada pelo cliente",
    neighborhood: "bairro mencionado pelo cliente",
    role:         "cargo ou função do cliente",
  };

  // Build the fields section (standard + custom)
  const fieldsToExtract = [
    ...standardFields.map((key) => `- ${key}: ${standardFieldDescriptions[key] ?? key}`),
    ...customFields.map((f) => `- ${f.key}: ${f.label}${f.description ? ` — ${f.description}` : ""}`),
  ].join("\n");

  // Build example JSON keys
  const exampleKeys = [
    ...standardFields,
    ...customFields.map((f) => f.key),
  ].map((k) => `"${k}":null`).join(",");

  const prompt = `Analise a conversa de WhatsApp abaixo e extraia dados de identificação do CLIENTE (quem está comprando/solicitando), não da empresa atendente.

CONVERSA:
${conversationBlock}

CAMPOS A EXTRAIR:
${fieldsToExtract}

EXEMPLOS:
- Cliente disse "Sou o Carlos, da Construtora ABC, CNPJ 12.345.678/0001-99": {"name":"Carlos","companyName":"Construtora ABC","document":"12.345.678/0001-99"}
- Cliente disse "João" após ser perguntado o nome: {"name":"João"}
- Cliente disse "de Campinas, CPF 123.456.789-00": {"city":"Campinas","document":"123.456.789-00"}
- Sem dados identificáveis: {${exampleKeys}}

REGRAS CRÍTICAS:
- NUNCA extraia como companyName palavras que sejam tipos de produtos, equipamentos ou acessórios (ex: "Rodizios", "Andaimes", "Escoras", "Sapatas", "Painéis", "Tubulares"). companyName deve ser o nome de uma empresa real do cliente.
- NUNCA extraia como name uma palavra que o cliente usou ao escolher um produto ou acessório (ex: "Rodizios", "Sapatas") — name deve ser o nome próprio de uma pessoa.
- Se a mensagem for uma resposta a uma pergunta técnica sobre equipamento (tipo de suporte, período, quantidade), não extraia nenhum campo de identificação.

Responda APENAS com JSON válido contendo os campos acima. Use null sem aspas para campos não encontrados.`;

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

    // Standard fields that map directly to lead columns
    const LEAD_COLUMNS = new Set(["name", "companyName", "city", "state", "document", "address", "neighborhood"]);
    for (const key of standardFields) {
      if (!LEAD_COLUMNS.has(key)) continue;
      const val = extracted[key];
      const current = (lead as Record<string, unknown>)[key];
      if (val && !current) dbUpdate[key] = val;
    }

    // role always goes to context (no dedicated column)
    const ctxPatch: Record<string, string> = {};
    if (extracted.role && !existingCtx?.role) ctxPatch.role = extracted.role;

    // Custom fields go to context
    for (const field of customFields) {
      const val = extracted[field.key];
      if (val && !existingCtx?.[field.key]) ctxPatch[field.key] = val;
    }

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
