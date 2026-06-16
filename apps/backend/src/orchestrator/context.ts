import type { Company, Lead, Conversation, Agent } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

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
Estágio: ${lead.stage} | Contexto coletado: ${JSON.stringify(lead.context)}
`.trim();

  return `${agent.prompt}

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
