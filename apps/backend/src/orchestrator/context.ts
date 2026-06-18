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

interface ContextInput {
  company: Company & { commercialRules: { hasFixedPriceTable: boolean; allowsDiscount: boolean; maxDiscountPercent: unknown; paymentMethods: string[] } | null };
  lead: Lead;
  conversation: Conversation;
  agent: Agent;
  sentiment: string;
}

export async function buildAgentContext(input: ContextInput): Promise<string> {
  const { company, lead, conversation, agent, sentiment } = input;

  const products = await prisma.product.findMany({
    where: {
      companyId: company.id,
      isActive: true,
      ...(agent.type === "commercial" ? {} : {}),
    },
    take: 20,
  });

  const rules = company.commercialRules;

  const productList = products
    .map(
      (p) =>
        `- ${p.name} (${p.category}): R$ ${p.dailyPrice}/dia, prazo mín. ${p.minimumDays} dias. Info obrigatória p/ orçamento: ${(p.requiredInfoForQuote as string[]).join(", ")}`
    )
    .join("\n");

  const rulesText = rules
    ? `
Regras comerciais:
- Tabela fixa: ${rules.hasFixedPriceTable ? "Sim" : "Não"}
- Desconto: ${rules.allowsDiscount ? `Sim, até ${rules.maxDiscountPercent}%` : "Não"}
- Formas de pagamento: ${(rules.paymentMethods as string[]).join(", ")}
`.trim()
    : "";

  const leadInfo = `
Cliente: ${lead.name ?? "Não identificado"} | Empresa: ${lead.companyName ?? "Não informada"} | Temperatura: ${sentiment}
Documento: ${lead.document ?? "Não informado"} | Cidade: ${lead.city ?? "Não informada"} | Estado: ${lead.state ?? "Não informado"}
Endereço: ${lead.address ?? "Não informado"} | Bairro: ${lead.neighborhood ?? "Não informado"}
Estágio: ${lead.stage} | Contexto adicional: ${JSON.stringify(lead.context)}
`.trim();

  // For attendance agents with collectFields, inject a live status section
  const collectCfg = agent.type === "attendance" && agent.collectFields
    ? (agent.collectFields as CollectFieldsConfig)
    : null;
  const collectSection = collectCfg ? buildCollectSection(lead, collectCfg) : "";

  return `${agent.prompt}
${collectSection ? `\n${collectSection}\n` : ""}
EMPRESA: ${company.name}

${leadInfo}

EQUIPAMENTOS DISPONÍVEIS:
${productList || "Nenhum cadastrado ainda."}

${rulesText}

INSTRUÇÕES OPERACIONAIS:
- Colete as informações necessárias de forma natural, não como formulário
- Quando tiver todas as informações para orçamento, gere o valor e apresente
- Quando o cliente aprovar o orçamento, inclua [TRANSBORDO] na resposta para transferir para a equipe
- Não invente preços ou produtos que não estão listados
- Seja objetivo e comercialmente eficiente`;
}
