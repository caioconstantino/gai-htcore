import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import type { Agent, Company, Lead, Conversation } from "@prisma/client";
import type { AIProvider, ChatMessage } from "../ai/types.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { buildAgentContext } from "./context.js";
import { generateQuotePDF, type QuoteItem } from "../services/quote-pdf.js";
import { dispatchDocument, type WhatsAppCompany } from "../whatsapp/dispatcher.js";
import type { SpecialistResult } from "./specialist-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads", "quotes");

// Ensure uploads directory exists on first use
function ensureDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ── Quote number generator ────────────────────────────────────────

async function nextQuoteNumber(companyId: string): Promise<string> {
  const count = await prisma.quote.count({ where: { companyId } });
  return String(count + 1).padStart(4, "0");
}

// ── AI-based quote extraction ─────────────────────────────────────

interface ExtractedQuote {
  items: QuoteItem[];
  deliveryLocation?: string;
  notes?: string;
  clientName?: string;
}

const EXTRACTION_PROMPT = `Você é um extrator de dados de orçamento. Analise o histórico da conversa e a tabela de equipamentos disponíveis e extraia os dados do pedido do cliente.

INSTRUÇÕES:
- Identifique todos os produtos/equipamentos que o cliente pediu para cotar
- Use os preços EXATOS da tabela de equipamentos abaixo para cada produto e período
- Se o período não estiver exato na tabela, use o período mais próximo disponível
- Para quantidade: use o valor informado pelo cliente (default 1)
- Para entrega: cidade/local mencionado pelo cliente

RESPONDA SOMENTE com JSON válido, sem texto adicional:
{
  "items": [
    {
      "productName": "nome exato do produto da tabela",
      "description": "especificações adicionais (altura, largura, etc)",
      "quantity": 1,
      "periodDays": 7,
      "unitPrice": 50.00
    }
  ],
  "deliveryLocation": "cidade/local",
  "notes": "observações relevantes (acessórios, condições especiais, etc)",
  "clientName": "nome do cliente se mencionado"
}`;

async function extractQuoteFromConversation(
  history: ChatMessage[],
  userMessage: string,
  aiProvider: AIProvider,
  agentContext: string,
): Promise<ExtractedQuote | null> {
  const historyText = history
    .slice(-16)
    .map((m) => `[${m.role === "user" ? "cliente" : "assistente"}]: ${m.content}`)
    .join("\n");

  const fullPrompt = `${agentContext}\n\n${EXTRACTION_PROMPT}`;

  try {
    const { response } = await aiProvider.chat({
      systemPrompt: fullPrompt,
      history: [],
      userMessage: `HISTÓRICO DA CONVERSA:\n${historyText}\n\nMENSAGEM ATUAL DO CLIENTE: "${userMessage}"\n\nExtraia os dados do orçamento:`,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn("Quoter: no JSON in extraction response", { response: response.slice(0, 200) });
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as ExtractedQuote;
    if (!parsed.items || parsed.items.length === 0) return null;

    // Filter items with invalid prices
    parsed.items = parsed.items.filter((i) => i.productName && i.unitPrice > 0 && i.periodDays > 0);
    return parsed.items.length > 0 ? parsed : null;
  } catch (err) {
    logger.error("Quoter: extraction failed", { err });
    return null;
  }
}

// ── Main quoter runner ────────────────────────────────────────────

export async function runQuoterAgent(input: {
  specialist:   Agent;
  company:      Company & { commercialRules: unknown; metadata?: unknown };
  lead:         Lead;
  conversation: Conversation;
  userMessage:  string;
  history:      ChatMessage[];
  aiProvider:   AIProvider;
  getProvider?: (agent: Agent) => AIProvider;
  sentiment:    string;
  onLog?:       (name: string, msg: string, meta?: Record<string, unknown>) => Promise<void>;
  directMode?:  boolean;
}): Promise<SpecialistResult> {
  const { specialist, company, lead, conversation, userMessage, history, sentiment, onLog } = input;
  const aiProvider = input.getProvider ? input.getProvider(specialist) : input.aiProvider;

  await onLog?.(specialist.name, "Iniciando geração de orçamento — extraindo dados da conversa...");

  const base: SpecialistResult = {
    specialistId:   specialist.id,
    specialistName: specialist.name,
    specialistType: specialist.type,
    response:       "",
    tokensIn:       0,
    tokensOut:      0,
  };

  try {
    // Build context so AI has the product price table available
    const agentContext = await buildAgentContext({
      company: company as Parameters<typeof buildAgentContext>[0]["company"],
      lead,
      conversation,
      agent: specialist,
      sentiment,
    });

    // 1. Extract quote items from conversation history
    const extracted = await extractQuoteFromConversation(history, userMessage, aiProvider, agentContext);

    if (!extracted) {
      base.response = "Não consegui identificar os itens do orçamento na nossa conversa. Poderia confirmar: qual equipamento, quantidade e período de locação você precisa?";
      return base;
    }

    await onLog?.(specialist.name, `Itens identificados: ${extracted.items.map((i) => i.productName).join(", ")}`);

    // 2. Create Quote + QuoteItems in DB
    const quoteNumber = await nextQuoteNumber(company.id);
    const totalValue  = extracted.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    // Create Quote first (no nested items — avoids Prisma client-side relation validation)
    const quote = await prisma.quote.create({
      data: {
        companyId:        company.id,
        leadId:           lead.id,
        totalValue,
        discountPercent:  0,
        deliveryLocation: extracted.deliveryLocation,
        notes:            extracted.notes,
        status:           "sent",
      },
    });

    // Insert QuoteItems via raw SQL so productId can be NULL without Prisma complaining
    for (const item of extracted.items) {
      const itemId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO quote_items (id, "quoteId", "productName", quantity, "unitPrice", "totalPrice", "periodDays")
        VALUES (${itemId}, ${quote.id}, ${item.productName}, ${item.quantity}, ${item.unitPrice}::numeric, ${item.quantity * item.unitPrice}::numeric, ${item.periodDays})
      `;
    }

    await onLog?.(specialist.name, `Orçamento #${quoteNumber} criado no banco (id: ${quote.id})`);

    // 3. Generate PDF
    ensureDir();
    const meta = (company.metadata ?? {}) as Record<string, string>;

    const pdfBuffer = await generateQuotePDF({
      quoteNumber,
      companyName:       company.name,
      companyPhone:      meta.telefoneContato,
      companyAddress:    meta.enderecoSede,
      companyWebsite:    meta.website,
      clientName:        lead.name ?? extracted.clientName,
      clientPhone:       lead.phone,
      items:             extracted.items,
      deliveryLocation:  extracted.deliveryLocation,
      notes:             extracted.notes,
      validDays:         15,
    });

    const filename = `orcamento-${quote.id}.pdf`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, pdfBuffer);

    // 4. Build public URL and update Quote record
    const backendUrl = (process.env.BACKEND_PUBLIC_URL ?? "").replace(/\/$/, "");
    const pdfUrl     = backendUrl ? `${backendUrl}/uploads/quotes/${filename}` : "";

    await prisma.quote.update({ where: { id: quote.id }, data: { pdfUrl: pdfUrl || null } });

    await onLog?.(specialist.name, `PDF gerado: ${filename} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

    // 5. Send document via WhatsApp (if public URL is available)
    if (pdfUrl) {
      try {
        await dispatchDocument(
          company as WhatsAppCompany,
          lead.phone,
          pdfUrl,
          `Orçamento-${quoteNumber}.pdf`,
          `📋 Orçamento #${quoteNumber} — ${company.name}\n\nConfira o PDF com todos os detalhes!`,
        );
        await onLog?.(specialist.name, `PDF enviado via WhatsApp para ${lead.phone}`);
      } catch (sendErr) {
        logger.error("Quoter: WhatsApp document send failed", { sendErr });
        await onLog?.(specialist.name, `Falha ao enviar PDF via WhatsApp: ${(sendErr as Error).message}`, { error: true });
      }
    } else {
      logger.warn("Quoter: BACKEND_PUBLIC_URL not set — PDF generated locally but not sent via WhatsApp");
    }

    // 6. Build success reply
    const itemsSummary = extracted.items
      .map((i) => `• ${i.productName} × ${i.quantity} (${i.periodDays} dias): ${fmtBRL(i.quantity * i.unitPrice)}`)
      .join("\n");

    base.response = [
      `✅ Orçamento *#${quoteNumber}* gerado com sucesso!`,
      "",
      `*${company.name}*`,
      `Cliente: ${lead.name ?? "—"} | ${extracted.deliveryLocation ? `Local: ${extracted.deliveryLocation}` : ""}`,
      "",
      itemsSummary,
      "",
      `*Total: ${fmtBRL(totalValue)}*`,
      `Validade: 15 dias`,
      "",
      pdfUrl
        ? "O PDF com o orçamento completo foi enviado! 📄"
        : `Seu orçamento foi registrado. Entre em contato para receber o PDF.`,
    ].join("\n");

    return base;

  } catch (err) {
    logger.error("Quoter agent failed", { err });
    await onLog?.(specialist.name, `Erro na geração do orçamento: ${(err as Error).message}`, { error: true });
    base.response = "Ocorreu um erro ao gerar o orçamento. Por favor, tente novamente ou entre em contato diretamente.";
    return base;
  }
}

function fmtBRL(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}
