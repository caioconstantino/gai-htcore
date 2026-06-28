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

function ensureDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function nextQuoteNumber(companyId: string): Promise<string> {
  const count = await prisma.quote.count({ where: { companyId } });
  return String(count + 1).padStart(4, "0");
}

// ── Types ─────────────────────────────────────────────────────────

interface ExtractedQuote {
  items: QuoteItem[];
  deliveryLocation?: string;
  notes?: string;
  clientName?: string;
}

interface QuoteEdit {
  add:      QuoteItem[];
  remove:   string[];           // exact productName strings to delete
  modify:   Array<{ productName: string; quantity: number }>;
  noChange: boolean;            // true = client just wants PDF re-sent
}

interface ExistingQuoteItem {
  id:          string;
  productName: string;
  quantity:    number;
  unitPrice:   number;
  totalPrice:  number;
  periodDays:  number;
}

// ── Extraction prompts ────────────────────────────────────────────

const CREATE_PROMPT = `Você é um extrator de dados de orçamento. Analise o histórico da conversa e a tabela de equipamentos disponíveis e extraia os dados do pedido do cliente.

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
  "notes": "observações relevantes",
  "clientName": "nome do cliente se mencionado"
}`;

function buildEditPrompt(currentItems: ExistingQuoteItem[]): string {
  const itemList = currentItems
    .map((i) => `• ${i.productName} × ${i.quantity} (${i.periodDays} dias) @ R$${Number(i.unitPrice).toFixed(2)}`)
    .join("\n");

  return `Você é um extrator de alterações de orçamento. O cliente quer modificar o orçamento atual.

ITENS ATUAIS DO ORÇAMENTO:
${itemList}

Analise a mensagem do cliente e identifique o que ele quer mudar.
Use os preços EXATOS da tabela de equipamentos para novos itens.

RESPONDA SOMENTE com JSON válido, sem texto adicional:
{
  "add": [
    { "productName": "nome exato da tabela", "quantity": 1, "periodDays": 7, "unitPrice": 50.00 }
  ],
  "remove": ["nome exato do produto a remover"],
  "modify": [
    { "productName": "nome exato já existente", "quantity": 10 }
  ],
  "noChange": false
}

Se o cliente apenas quer reenviar/ver o orçamento sem alterações, use: { "add": [], "remove": [], "modify": [], "noChange": true }`;
}

// ── Helpers ───────────────────────────────────────────────────────

async function loadPreviousQuoteItems(leadId: string, companyId: string): Promise<string> {
  const recentQuotes = await prisma.quote.findMany({
    where: { leadId, companyId },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { items: { select: { productName: true, quantity: true, unitPrice: true, periodDays: true } } },
  });
  if (recentQuotes.length === 0) return "";

  const lines = recentQuotes.map((q) => {
    const itemLines = q.items
      .map((i) => `  - ${i.productName} × ${i.quantity} (${i.periodDays} dias) @ R$${Number(i.unitPrice).toFixed(2)}`)
      .join("\n");
    return `Orçamento anterior (${q.createdAt.toLocaleDateString("pt-BR")}):\n${itemLines || "  (sem itens)"}`;
  });

  return `\nORÇAMENTOS ANTERIORES DESTA SESSÃO (use como referência se o cliente pedir para incluir itens de orçamentos anteriores):\n${lines.join("\n\n")}\n`;
}

async function extractNewQuote(
  history: ChatMessage[],
  userMessage: string,
  aiProvider: AIProvider,
  agentContext: string,
  previousQuotesContext: string,
): Promise<ExtractedQuote | null> {
  const historyText = history
    .slice(-20)
    .map((m) => `[${m.role === "user" ? "cliente" : "assistente"}]: ${m.content}`)
    .join("\n");

  try {
    const { response } = await aiProvider.chat({
      systemPrompt: `${agentContext}\n\n${CREATE_PROMPT}`,
      history: [],
      userMessage: `HISTÓRICO DA CONVERSA:\n${historyText}${previousQuotesContext}\n\nMENSAGEM ATUAL DO CLIENTE: "${userMessage}"\n\nExtraia os dados do orçamento:`,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as ExtractedQuote;
    if (!parsed.items?.length) return null;
    parsed.items = parsed.items.filter((i) => i.productName && i.unitPrice > 0 && i.periodDays > 0);
    return parsed.items.length > 0 ? parsed : null;
  } catch (err) {
    logger.error("Quoter: extraction failed", { err });
    return null;
  }
}

async function extractQuoteEdit(
  history: ChatMessage[],
  userMessage: string,
  aiProvider: AIProvider,
  agentContext: string,
  currentItems: ExistingQuoteItem[],
): Promise<QuoteEdit | null> {
  const historyText = history
    .slice(-10)
    .map((m) => `[${m.role === "user" ? "cliente" : "assistente"}]: ${m.content}`)
    .join("\n");

  try {
    const { response } = await aiProvider.chat({
      systemPrompt: `${agentContext}\n\n${buildEditPrompt(currentItems)}`,
      history: [],
      userMessage: `HISTÓRICO RECENTE:\n${historyText}\n\nMENSAGEM DO CLIENTE: "${userMessage}"\n\nIdentifique as alterações:`,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as QuoteEdit;
    return {
      add:      Array.isArray(parsed.add)    ? parsed.add.filter((i) => i.productName && i.unitPrice > 0)    : [],
      remove:   Array.isArray(parsed.remove) ? parsed.remove.filter(Boolean) : [],
      modify:   Array.isArray(parsed.modify) ? parsed.modify.filter((m) => m.productName && m.quantity > 0) : [],
      noChange: !!parsed.noChange,
    };
  } catch (err) {
    logger.error("Quoter: edit extraction failed", { err });
    return null;
  }
}

// ── PDF generation & send ─────────────────────────────────────────

async function generateAndSendPDF(
  quote: { id: string },
  quoteNumber: string,
  company: Company & { metadata?: unknown },
  lead: Lead,
  items: QuoteItem[],
  deliveryLocation: string | undefined,
  notes: string | undefined,
  onLog: (msg: string) => Promise<void>,
): Promise<string> {
  ensureDir();
  const meta = (company.metadata ?? {}) as Record<string, string>;

  const pdfBuffer = await generateQuotePDF({
    quoteNumber,
    companyName:      company.name,
    companyPhone:     meta.telefoneContato,
    companyAddress:   meta.enderecoSede,
    companyWebsite:   meta.website,
    clientName:       lead.name ?? undefined,
    clientPhone:      lead.phone,
    items,
    deliveryLocation,
    notes,
    validDays: 15,
  });

  const filename = `orcamento-${quote.id}.pdf`;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, pdfBuffer);
  await onLog(`PDF gerado: ${filename} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  const backendUrl = (process.env.BACKEND_PUBLIC_URL ?? "").replace(/\/$/, "");
  const pdfUrl     = backendUrl ? `${backendUrl}/uploads/quotes/${filename}` : "";

  await prisma.quote.update({ where: { id: quote.id }, data: { pdfUrl: pdfUrl || null } });

  if (pdfUrl) {
    try {
      await dispatchDocument(
        company as WhatsAppCompany,
        lead.phone,
        pdfUrl,
        `Orçamento-${quoteNumber}.pdf`,
        `📋 Orçamento #${quoteNumber} — ${company.name}\n\nConfira o PDF com todos os detalhes!`,
      );
      await onLog(`PDF enviado via WhatsApp para ${lead.phone}`);
    } catch (sendErr) {
      logger.error("Quoter: WhatsApp document send failed", { sendErr });
      await onLog(`Falha ao enviar PDF: ${(sendErr as Error).message}`);
    }
  }

  return pdfUrl;
}

function buildSuccessReply(
  quoteNumber: string,
  companyName: string,
  leadName: string | null | undefined,
  deliveryLocation: string | undefined,
  items: QuoteItem[],
  totalValue: number,
  pdfUrl: string,
  editSummary?: string,
): string {
  const itemsSummary = items
    .map((i) => `• ${i.productName} × ${i.quantity} (${i.periodDays} dias): ${fmtBRL(i.quantity * i.unitPrice)}`)
    .join("\n");

  const header = editSummary
    ? `✅ Orçamento *#${quoteNumber}* atualizado!${editSummary}`
    : `✅ Orçamento *#${quoteNumber}* gerado com sucesso!`;

  return [
    header,
    "",
    `*${companyName}*`,
    `Cliente: ${leadName ?? "—"} | ${deliveryLocation ? `Local: ${deliveryLocation}` : ""}`,
    "",
    itemsSummary,
    "",
    `*Total: ${fmtBRL(totalValue)}*`,
    `Validade: 15 dias`,
    "",
    pdfUrl
      ? "O PDF atualizado foi enviado! 📄"
      : "Seu orçamento foi registrado. Entre em contato para receber o PDF.",
  ].join("\n");
}

// ── Main runner ───────────────────────────────────────────────────

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
  const log = (msg: string, meta?: Record<string, unknown>) => onLog?.(specialist.name, msg, meta) ?? Promise.resolve();

  await log("Iniciando geração de orçamento — extraindo dados da conversa...");

  const base: SpecialistResult = {
    specialistId:   specialist.id,
    specialistName: specialist.name,
    specialistType: specialist.type,
    response:       "",
    tokensIn:       0,
    tokensOut:      0,
  };

  try {
    const agentContext = await buildAgentContext({
      company: company as Parameters<typeof buildAgentContext>[0]["company"],
      lead,
      conversation,
      agent: specialist,
      sentiment,
    });

    const convCtx = (conversation.context ?? {}) as Record<string, unknown>;
    const activeQuoteId = convCtx.activeQuoteId as string | undefined;

    // ── EDIT MODE ──────────────────────────────────────────────────
    if (activeQuoteId) {
      const activeQuote = await prisma.quote.findUnique({
        where: { id: activeQuoteId },
        include: { items: true },
      });

      if (activeQuote) {
        await log(`Orçamento ativo encontrado: #${activeQuoteId.slice(-6)} — verificando alterações...`);

        const currentItems: ExistingQuoteItem[] = activeQuote.items.map((i) => ({
          id:          i.id,
          productName: i.productName,
          quantity:    i.quantity,
          unitPrice:   Number(i.unitPrice),
          totalPrice:  Number(i.totalPrice),
          periodDays:  i.periodDays,
        }));

        const edit = await extractQuoteEdit(history, userMessage, aiProvider, agentContext, currentItems);

        if (!edit) {
          base.response = "Não consegui identificar a alteração desejada. Poderia descrever o que quer adicionar, remover ou modificar no orçamento?";
          return base;
        }

        const hasChanges = !edit.noChange && (edit.add.length > 0 || edit.remove.length > 0 || edit.modify.length > 0);

        if (hasChanges) {
          const changeLines: string[] = [];

          // Remove items
          for (const name of edit.remove) {
            const item = currentItems.find((i) => i.productName.toLowerCase() === name.toLowerCase());
            if (item) {
              await prisma.$executeRaw`DELETE FROM quote_items WHERE id = ${item.id}`;
              changeLines.push(`❌ Removido: ${item.productName}`);
            }
          }

          // Modify quantities
          for (const mod of edit.modify) {
            const item = currentItems.find((i) => i.productName.toLowerCase() === mod.productName.toLowerCase());
            if (item) {
              const newTotal = mod.quantity * item.unitPrice;
              await prisma.$executeRaw`
                UPDATE quote_items SET quantity = ${mod.quantity}, "totalPrice" = ${newTotal}::numeric WHERE id = ${item.id}
              `;
              changeLines.push(`✏️ Modificado: ${item.productName} → ${mod.quantity}× (era ${item.quantity}×)`);
            }
          }

          // Add new items
          for (const newItem of edit.add) {
            const itemId = randomUUID();
            await prisma.$executeRaw`
              INSERT INTO quote_items (id, "quoteId", "productName", quantity, "unitPrice", "totalPrice", "periodDays")
              VALUES (${itemId}, ${activeQuote.id}, ${newItem.productName}, ${newItem.quantity}, ${newItem.unitPrice}::numeric, ${newItem.quantity * newItem.unitPrice}::numeric, ${newItem.periodDays})
            `;
            changeLines.push(`➕ Adicionado: ${newItem.productName} × ${newItem.quantity} (${newItem.periodDays} dias)`);
          }

          // Recalculate total from updated items
          const updatedItems = await prisma.quoteItem.findMany({ where: { quoteId: activeQuote.id } });
          const newTotal = updatedItems.reduce((sum, i) => sum + Number(i.totalPrice), 0);
          await prisma.quote.update({ where: { id: activeQuote.id }, data: { totalValue: newTotal } });

          const quoteNumber = String((await prisma.quote.count({ where: { companyId: company.id } }))).padStart(4, "0");
          const editSummary = `\n${changeLines.join("\n")}`;
          await log(`Orçamento editado: ${changeLines.join(" | ")}`);

          const allItems: QuoteItem[] = updatedItems.map((i) => ({
            productName: i.productName,
            quantity:    i.quantity,
            unitPrice:   Number(i.unitPrice),
            periodDays:  i.periodDays,
          }));

          const pdfUrl = await generateAndSendPDF(
            activeQuote,
            quoteNumber,
            company,
            lead,
            allItems,
            activeQuote.deliveryLocation ?? undefined,
            activeQuote.notes ?? undefined,
            (msg) => log(msg),
          );

          base.response = buildSuccessReply(quoteNumber, company.name, lead.name, activeQuote.deliveryLocation ?? undefined, allItems, newTotal, pdfUrl, editSummary);
          return base;
        }

        // No changes — just re-send the PDF
        await log("Nenhuma alteração detectada — reenviando PDF existente...");
        const quoteNumber = String(await prisma.quote.count({ where: { companyId: company.id } })).padStart(4, "0");
        const allItems: QuoteItem[] = currentItems.map((i) => ({
          productName: i.productName,
          quantity:    i.quantity,
          unitPrice:   i.unitPrice,
          periodDays:  i.periodDays,
        }));

        const pdfUrl = await generateAndSendPDF(
          activeQuote,
          quoteNumber,
          company,
          lead,
          allItems,
          activeQuote.deliveryLocation ?? undefined,
          activeQuote.notes ?? undefined,
          (msg) => log(msg),
        );

        base.response = buildSuccessReply(quoteNumber, company.name, lead.name, activeQuote.deliveryLocation ?? undefined, allItems, Number(activeQuote.totalValue), pdfUrl);
        return base;
      }
    }

    // ── CREATE MODE ────────────────────────────────────────────────
    const previousQuotesContext = await loadPreviousQuoteItems(lead.id, company.id);
    const extracted = await extractNewQuote(history, userMessage, aiProvider, agentContext, previousQuotesContext);

    if (!extracted) {
      base.response = "Não consegui identificar os itens do orçamento na nossa conversa. Poderia confirmar: qual equipamento, quantidade e período de locação você precisa?";
      return base;
    }

    await log(`Itens identificados: ${extracted.items.map((i) => i.productName).join(", ")}`);

    const quoteNumber = await nextQuoteNumber(company.id);
    const totalValue  = extracted.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

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

    for (const item of extracted.items) {
      const itemId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO quote_items (id, "quoteId", "productName", quantity, "unitPrice", "totalPrice", "periodDays")
        VALUES (${itemId}, ${quote.id}, ${item.productName}, ${item.quantity}, ${item.unitPrice}::numeric, ${item.quantity * item.unitPrice}::numeric, ${item.periodDays})
      `;
    }

    await log(`Orçamento #${quoteNumber} criado no banco (id: ${quote.id})`);

    // Save activeQuoteId in conversation context so edits can reference it
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { context: { ...convCtx, activeQuoteId: quote.id } },
    });

    const pdfUrl = await generateAndSendPDF(
      quote,
      quoteNumber,
      company,
      lead,
      extracted.items,
      extracted.deliveryLocation,
      extracted.notes,
      (msg) => log(msg),
    );

    base.response = buildSuccessReply(quoteNumber, company.name, lead.name ?? extracted.clientName, extracted.deliveryLocation, extracted.items, totalValue, pdfUrl);
    return base;

  } catch (err) {
    logger.error("Quoter agent failed", { err });
    await log(`Erro na geração do orçamento: ${(err as Error).message}`, { error: true });
    base.response = "Ocorreu um erro ao gerar o orçamento. Por favor, tente novamente ou entre em contato diretamente.";
    return base;
  }
}

function fmtBRL(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}
