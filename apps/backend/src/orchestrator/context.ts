import type { Company, Lead, Conversation, Agent } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

interface CollectFieldsConfig {
  standard: string[];
  custom: Array<{ key: string; label: string; description?: string }>;
}

const STANDARD_FIELD_LABELS: Record<string, string> = {
  name:         "Nome do cliente",
  companyName:  "Empresa",
  document:     "CNPJ / CPF",
  city:         "Cidade",
  state:        "Estado",
  address:      "Endereço",
  neighborhood: "Bairro",
};

function getLeadFieldValue(lead: Lead, key: string): string | null {
  const direct = (lead as Record<string, unknown>)[key];
  if (typeof direct === "string" && direct.trim()) return direct;
  const ctx = lead.context as Record<string, unknown>;
  const fromCtx = ctx?.[key];
  return typeof fromCtx === "string" && fromCtx.trim() ? fromCtx : null;
}

function buildCollectSection(lead: Lead, cfg: CollectFieldsConfig): string {
  const lines: string[] = [];

  for (const key of cfg.standard) {
    const label = STANDARD_FIELD_LABELS[key] ?? key;
    const value = getLeadFieldValue(lead, key);
    lines.push(value ? `[✓ COLETADO] ${label}: ${value}` : `[PENDENTE] ${label}`);
  }

  for (const field of cfg.custom) {
    const value = getLeadFieldValue(lead, field.key);
    const desc = field.description ? ` — ${field.description}` : "";
    lines.push(value ? `[✓ COLETADO] ${field.label}: ${value}` : `[PENDENTE] ${field.label}${desc}`);
  }

  if (lines.length === 0) return "";

  const allDone = lines.every((l) => l.startsWith("[✓"));

  return `━━━ DADOS A COLETAR ━━━
${lines.join("\n")}

${allDone
    ? "Todos os dados foram coletados. Encerre a identificação de forma cordial."
    : "Pergunte APENAS pelo que está [PENDENTE], um por mensagem. Nunca repita o que está [✓ COLETADO]."}
━━━━━━━━━━━━━━━━━━━━━━`;
}

// ── Price table formatter ─────────────────────────────────────────

const PERIOD_ORDER = ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","21","22","23","24","25","26","27","28","29","30","365"];

const PERIOD_LABELS: Record<string, string> = {
  "1": "Diária", "2": "2 dias", "3": "3 dias", "4": "4 dias", "5": "5 dias",
  "6": "6 dias", "7": "7 dias", "8": "8 dias", "9": "9 dias", "10": "10 dias",
  "11": "11 dias", "12": "12 dias", "13": "13 dias", "14": "14 dias", "15": "15 dias",
  "16": "16 dias", "17": "17 dias", "18": "18 dias", "19": "19 dias", "21": "21 dias",
  "22": "22 dias", "23": "23 dias", "24": "24 dias", "25": "25 dias", "26": "26 dias",
  "27": "27 dias", "28": "28 dias", "29": "29 dias", "30": "30 dias", "365": "365 dias",
};

function formatBRL(value: number): string {
  return `R$${value.toFixed(2).replace(".", ",")}`;
}

function formatPriceTable(prices: unknown): string {
  if (!prices || typeof prices !== "object") return "";
  const priceMap = prices as Record<string, number>;
  const entries = PERIOD_ORDER
    .filter((k) => priceMap[k] != null && Number(priceMap[k]) > 0)
    .map((k) => `${PERIOD_LABELS[k]}: ${formatBRL(Number(priceMap[k]))}`);
  return entries.join(" | ");
}

// ── Product fetching ──────────────────────────────────────────────

interface ContextInput {
  company: Company & { commercialRules: { hasFixedPriceTable: boolean; allowsDiscount: boolean; maxDiscountPercent: unknown; paymentMethods: string[] } | null };
  lead: Lead;
  conversation: Conversation;
  agent: Agent;
  sentiment: string;
}

export async function buildAgentContext(input: ContextInput): Promise<string> {
  const { company, lead, conversation, agent, sentiment } = input;

  // Category filter: specialist agents have dynamicValues.categoria set
  const dynamicVals = (agent.dynamicValues ?? {}) as Record<string, string>;
  const categoryFilter = dynamicVals["categoria"] ?? null;

  // Fetch products: company-own + company-selected global products (via CompanyProduct)
  const [ownProducts, selectedGlobalProducts] = await Promise.all([
    prisma.product.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        ...(categoryFilter ? { category: { equals: categoryFilter, mode: "insensitive" } } : {}),
      },
      take: 50,
    }),
    prisma.companyProduct.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        ...(categoryFilter ? { product: { category: { equals: categoryFilter, mode: "insensitive" } } } : {}),
      },
      include: { product: true },
      take: 50,
    }),
  ]);

  // Merge, dedup (own products take priority over global ones with same id)
  const seenIds = new Set<string>();
  type ProductEntry = typeof ownProducts[number];
  const allProducts: ProductEntry[] = [];

  for (const p of ownProducts) {
    seenIds.add(p.id);
    allProducts.push(p);
  }

  for (const cp of selectedGlobalProducts) {
    if (seenIds.has(cp.product.id)) continue;
    seenIds.add(cp.product.id);
    // Apply company price overrides to compat fields, keep full prices JSON from global product
    allProducts.push({
      ...cp.product,
      dailyPrice: cp.dailyPrice ?? cp.product.dailyPrice,
      weeklyPrice: cp.weeklyPrice ?? cp.product.weeklyPrice,
      monthlyPrice: cp.monthlyPrice ?? cp.product.monthlyPrice,
    });
  }

  // Fallback: if category specialist has no company products yet, show global catalog for that category
  let products = allProducts;
  if (products.length === 0 && categoryFilter) {
    const globalFallback = await prisma.product.findMany({
      where: { isGlobal: true, isActive: true, category: { equals: categoryFilter, mode: "insensitive" } },
      take: 50,
    });
    products = globalFallback;
  }

  const rules = company.commercialRules;

  // Format product catalog with full price table
  const productList = products.length > 0
    ? products.map((p) => {
        const code = p.code ? `[${p.code}] ` : "";
        const desc = p.description ? ` — ${p.description}` : "";
        const priceStr = formatPriceTable(p.prices);
        const fallbackPrice = `Diária: ${formatBRL(Number(p.dailyPrice))}${p.weeklyPrice ? ` | 7 dias: ${formatBRL(Number(p.weeklyPrice))}` : ""}${p.monthlyPrice ? ` | 28 dias: ${formatBRL(Number(p.monthlyPrice))}` : ""}`;
        return `• ${code}${p.name}${desc}\n  ${priceStr || fallbackPrice}`;
      }).join("\n\n")
    : "Nenhum produto cadastrado para esta categoria.";

  const rulesText = rules
    ? `Regras comerciais:
- Tabela fixa: ${rules.hasFixedPriceTable ? "Sim" : "Não"}
- Desconto: ${rules.allowsDiscount ? `Sim, até ${rules.maxDiscountPercent}%` : "Não"}
- Formas de pagamento: ${(rules.paymentMethods as string[]).join(", ")}`.trim()
    : "";

  const leadInfo = `Cliente: ${lead.name ?? "Não identificado"} | Empresa: ${lead.companyName ?? "Não informada"} | Temperatura: ${sentiment}
Documento: ${lead.document ?? "Não informado"} | Cidade: ${lead.city ?? "Não informada"} | Estado: ${lead.state ?? "Não informado"}
Endereço: ${lead.address ?? "Não informado"} | Bairro: ${lead.neighborhood ?? "Não informado"}
Estágio: ${lead.stage}`.trim();

  // Dados extras já coletados (lead.context) formatados legível para especialistas
  const leadCtx = lead.context as Record<string, unknown> | null ?? {};
  const ctxEntries = Object.entries(leadCtx).filter(([, v]) => v !== null && v !== "");
  const leadContextSection = ctxEntries.length > 0
    ? `Dados já registrados: ${ctxEntries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" | ")}`
    : "";

  const collectCfg = agent.type === "attendance" && agent.collectFields
    ? (agent.collectFields as CollectFieldsConfig)
    : null;
  const collectSection = collectCfg ? buildCollectSection(lead, collectCfg) : "";

  const categoryHeader = categoryFilter
    ? `\nCATEGORIA DESTA ESPECIALIDADE: ${categoryFilter}\n`
    : "";

  // Anti-repetition block — injected for all specialist agents
  const antiRepeatSection = agent.type === "specialist" ? `
━━━ REGRAS DE COLETA (OBRIGATÓRIO) ━━━
ANTI-REPETIÇÃO: O histórico completo da conversa está disponível acima desta mensagem. Antes de fazer qualquer pergunta, releia o histórico e verifique o que o cliente JÁ respondeu. NUNCA repita uma pergunta para dado já fornecido.
COLETA PROGRESSIVA: Faça UMA pergunta por vez, apenas sobre a PRÓXIMA informação ainda não fornecida. Se o cliente já informou 3 dos 4 dados necessários, pergunte SOMENTE o 4º.
CONFIRMAÇÃO RÁPIDA: Ao receber dados parciais, confirme o que foi entendido em UMA frase e pergunte o próximo dado pendente. Ex: "Entendido — 15m, 8 torres, 1,5m. Qual o prazo de locação?"
ORÇAMENTO IMEDIATO: Assim que tiver TODOS os dados necessários, calcule e apresente o orçamento com os valores exatos da tabela. Não peça confirmação desnecessária.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : "";

  return `${agent.prompt}
${collectSection ? `\n${collectSection}\n` : ""}${categoryHeader}
EMPRESA: ${company.name}

${leadInfo}
${leadContextSection ? `${leadContextSection}\n` : ""}${antiRepeatSection}

━━━ TABELA DE EQUIPAMENTOS${categoryFilter ? ` — ${categoryFilter.toUpperCase()}` : ""} ━━━
${productList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${rulesText ? `${rulesText}\n\n` : ""}INSTRUÇÕES OPERACIONAIS:
- Use APENAS os preços da tabela acima — nunca invente valores
- Se o cliente pedir um período não listado, ofereça o período mais próximo disponível
- Quando tiver todas as informações, gere o orçamento com os valores exatos da tabela. Mostre: produto, quantidade, período, valor unitário e total
- Quando o cliente aprovar o orçamento, inclua [TRANSBORDO] para transferir ao time comercial
- Não invente produtos ou categorias que não estão na tabela`;
}
