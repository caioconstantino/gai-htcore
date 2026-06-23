import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma.js";
import { requireRole, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const globalProductsRouter: ExpressRouter = Router();

// ── Periods configuration ─────────────────────────────────────────
// Order matches the user's required XLSX column order
const PERIODS: { days: number; col: string }[] = [
  { days: 1, col: "Diária" },
  { days: 3, col: "03 dias" },
  { days: 7, col: "07 dias" },
  { days: 14, col: "14 dias" },
  { days: 28, col: "28 dias" },
  { days: 2, col: "02 dias" },
  { days: 4, col: "04 dias" },
  { days: 5, col: "05 dias" },
  { days: 6, col: "06 dias" },
  { days: 8, col: "08 dias" },
  { days: 9, col: "09 dias" },
  { days: 10, col: "10 dias" },
  { days: 11, col: "11 dias" },
  { days: 12, col: "12 dias" },
  { days: 13, col: "13 dias" },
  { days: 15, col: "15 dias" },
  { days: 16, col: "16 dias" },
  { days: 17, col: "17 dias" },
  { days: 18, col: "18 dias" },
  { days: 19, col: "19 dias" },
  { days: 21, col: "21 dias" },
  { days: 22, col: "22 dias" },
  { days: 23, col: "23 dias" },
  { days: 24, col: "24 dias" },
  { days: 25, col: "25 dias" },
  { days: 26, col: "26 dias" },
  { days: 27, col: "27 dias" },
  { days: 29, col: "29 dias" },
  { days: 30, col: "30 dias" },
  { days: 365, col: "365 Dias" },
];

// Parse price strings like "10", "10,00", "R$ 10,00", "1.200,50"
function parsePrice(raw: unknown): number | null {
  if (raw == null || raw === "" || raw === 0) return null;
  let str = String(raw).replace(/R\$\s*/gi, "").trim();
  if (!str || str === "0") return null;
  if (str.includes(",")) {
    // Brazilian format: dots are thousands separators, comma is decimal
    str = str.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(str);
  return isNaN(n) || n < 0 ? null : n;
}

function buildPricesFromRow(row: Record<string, unknown>): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const { days, col } of PERIODS) {
    const v = parsePrice(row[col]);
    if (v !== null && v > 0) prices[String(days)] = v;
  }
  return prices;
}

// Derive compat fields from prices JSON
function compatPrices(prices: Record<string, number>) {
  return {
    dailyPrice: prices["1"] ?? 0,
    weeklyPrice: prices["7"] ?? null,
    monthlyPrice: prices["28"] ?? null,
  };
}

const pricesSchema = z.record(z.string(), z.number().min(0));

const productSchema = z.object({
  code: z.string().max(50).optional().nullable(),
  name: z.string().min(2).max(200),
  category: z.string().min(1).max(100),
  description: z.string().max(2000).optional().nullable(),
  prices: pricesSchema.default({}),
  isMostSold: z.boolean().default(false),
  isHighRevenue: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

// ── Global catalog ────────────────────────────────────────────────

globalProductsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;

    const products = await prisma.product.findMany({
      where: {
        isGlobal: true,
        isActive: true,
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { name: "asc" },
    });

    const companyId = req.user?.role !== "super_admin" ? req.user?.companyId : undefined;
    if (companyId) {
      const selected = await prisma.companyProduct.findMany({
        where: { companyId },
        select: { productId: true, isActive: true },
      });
      const selectedMap = new Map(selected.map((s) => [s.productId, s.isActive]));
      const annotated = products.map((p) => ({
        ...p,
        selectedByCompany: selectedMap.has(p.id),
        companyProductActive: selectedMap.get(p.id) ?? false,
      }));
      res.json({ data: annotated, total: annotated.length });
      return;
    }

    res.json({ data: products, total: products.length });
  } catch (err) { next(err); }
});

globalProductsRouter.post("/", requireRole("super_admin"), async (req, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const { prices, ...rest } = parsed.data;
    const compat = compatPrices(prices as Record<string, number>);
    const product = await prisma.product.create({
      data: { ...rest, prices, ...compat, isGlobal: true, companyId: null },
    });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

globalProductsRouter.patch("/:id", requireRole("super_admin"), async (req, res, next) => {
  try {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const { prices, ...rest } = parsed.data;
    const compat = prices ? compatPrices(prices as Record<string, number>) : {};
    const product = await prisma.product.update({
      where: { id: req.params.id, isGlobal: true },
      data: { ...rest, ...(prices ? { prices } : {}), ...compat },
    });
    res.json(product);
  } catch (err) { next(err); }
});

globalProductsRouter.delete("/:id", requireRole("super_admin"), async (req, res, next) => {
  try {
    await prisma.product.update({ where: { id: req.params.id, isGlobal: true }, data: { isActive: false } });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── XLSX import / template ────────────────────────────────────────

globalProductsRouter.get("/import-template", requireRole("super_admin"), (_req, res) => {
  const headers = ["Código", "Categoria", "Equipamentos", ...PERIODS.map((p) => p.col)];
  const example1 = [
    "AND001", "Andaimes", "Andaime Tubular 1,0m",
    ...PERIODS.map((p) => [1, 3, 7, 14, 28].includes(p.days) ? (p.days === 1 ? 50 : p.days === 3 ? 130 : p.days === 7 ? 280 : p.days === 14 ? 490 : 840) : ""),
  ];
  const example2 = [
    "PLAT001", "Plataformas", "Plataforma Tesoura Elétrica",
    ...PERIODS.map((p) => [1, 3, 7, 14, 28].includes(p.days) ? (p.days === 1 ? 200 : p.days === 3 ? 520 : p.days === 7 ? 1100 : p.days === 14 ? 1960 : 3360) : ""),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example1, example2]);
  ws["!cols"] = [10, 18, 28, ...PERIODS.map(() => ({ wch: 10 }))].map((w) =>
    typeof w === "number" ? { wch: w } : w
  );
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  res.setHeader("Content-Disposition", 'attachment; filename="modelo-produtos.xlsx"');
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buf);
});

globalProductsRouter.post(
  "/import",
  requireRole("super_admin"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) { res.status(400).json({ error: "Nenhum arquivo enviado" }); return; }

      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

      let created = 0;
      const errors: string[] = [];
      const skipped: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const lineNum = i + 2;

        const code = row["Código"] ? String(row["Código"]).trim() : null;
        const category = String(row["Categoria"] ?? "").trim();
        const name = String(row["Equipamentos"] ?? "").trim();

        if (!name || name.length < 2) { errors.push(`Linha ${lineNum}: Nome (Equipamentos) obrigatório`); continue; }
        if (!category) { errors.push(`Linha ${lineNum}: Categoria obrigatória`); continue; }

        const prices = buildPricesFromRow(row);
        if (!prices["1"] && Object.keys(prices).length === 0) {
          errors.push(`Linha ${lineNum}: Nenhum preço informado`); continue;
        }

        const existing = await prisma.product.findFirst({
          where: { name: { equals: name, mode: "insensitive" }, isGlobal: true },
        });
        if (existing) { skipped.push(name); continue; }

        const compat = compatPrices(prices);
        await prisma.product.create({
          data: { code, name, category, prices, ...compat, isGlobal: true, companyId: null },
        });
        created++;
      }

      res.json({ created, skipped: skipped.length, skippedNames: skipped, errors });
    } catch (err) { next(err); }
  }
);

// ── Generate category specialist templates ────────────────────────

// Domain-specific trigger keywords per known category (Portuguese + common terms)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Andaimes": ["andaime", "andaimes", "tubular", "fachadeiro", "escalonado", "ringlock", "scaffold", "prancha"],
  "Plataformas Elevatórias": ["plataforma", "elevatória", "elevatoria", "tesoura", "articulada", "mastro", "manlift", "jirafas", "elevação aérea"],
  "Escoramento Metálico": ["escora", "escoramento", "escoras", "cimbramento", "suporte metálico", "escorar", "laje"],
  "Máquinas de Terraplanagem": ["terraplanagem", "escavadeira", "retroescavadeira", "niveladora", "motoniveladora", "pá carregadeira"],
  "Equipamentos de Elevação": ["guindaste", "grua", "munck", "içar", "içamento", "crane", "talha"],
  "Compactadores": ["compactador", "compactadora", "rolo compactador", "placa vibratória", "compactar", "compactação"],
  "Geradores": ["gerador", "geradores", "grupo gerador", "energia elétrica", "diesel"],
  "Ferramentas": ["ferramenta", "ferramentas", "furadeira", "martelete", "esmerilhadeira", "betoneira"],
  "Compressores": ["compressor", "compressores", "ar comprimido", "pneumático", "jato"],
  "Iluminação": ["iluminação", "holofote", "refletor", "torre de luz", "projetor"],
};

function buildKeywordsForCategory(category: string, productNames: string[]): string[] {
  const known = CATEGORY_KEYWORDS[category] ?? [];

  // Extract words from category name as fallback keywords
  const fromCategoryName = category
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Extract up to 2 words from each product name
  const fromProducts = productNames
    .flatMap((name) =>
      name.toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 2)
    )
    .slice(0, 15);

  return [...new Set([...known, ...fromCategoryName, ...fromProducts])];
}

function buildSpecialistPrompt(category: string): string {
  return `Você é o especialista comercial em {{categoria}} da {{nome_empresa}}.

Sua missão é entender exatamente o que o cliente precisa dentro da categoria {{categoria}}, apresentar os equipamentos disponíveis com preços precisos e fechar o orçamento.

━━━ FLUXO DE ATENDIMENTO ━━━
1. ENTENDIMENTO — Descubra qual equipamento específico o cliente precisa na categoria {{categoria}}
2. DETALHAMENTO — Colete as informações para o orçamento:
   - Equipamento desejado (tipo/modelo específico)
   - Local da obra (cidade de entrega)
   - Período de locação em dias
   - Tipo de cliente (Pessoa Física ou Jurídica)
3. ORÇAMENTO — Com os dados coletados, consulte a tabela de equipamentos injetada no contexto e apresente:
   - Nome do equipamento + período solicitado + preço exato da tabela
   - Prazo de pagamento: {{prazo_pagamento}}
   - Só mencione desconto se o cliente pedir — máximo autorizado: {{desconto_maximo}}%
4. FECHAMENTO — Quando o cliente confirmar o orçamento, use [TRANSBORDO] para encaminhar ao time comercial

━━━ REGRAS ESSENCIAIS ━━━
- USE APENAS os preços da tabela de equipamentos — nunca invente ou estime valores
- Se o cliente pedir um período que não está na tabela, ofereça o período disponível mais próximo
- Se o cliente mencionar um produto de outra categoria, informe que há especialistas específicos e oriente a perguntar ao atendimento geral
- Área de atendimento: {{area_atendimento}}
- Para obras fora da área de atendimento, informe a limitação e use [TRANSBORDO] se o cliente quiser prosseguir
- Mantenha o tom profissional, consultivo e objetivo`;
}

const SPECIALIST_DYNAMIC_FIELDS = [
  { key: "categoria", label: "Categoria de Produtos", type: "text", required: true, description: "Pré-configurado automaticamente com a categoria do especialista" },
  { key: "nome_empresa", label: "Nome da Empresa", type: "text", required: true, placeholder: "Ex: Locaza Rental" },
  { key: "area_atendimento", label: "Área de Atendimento", type: "textarea", required: false, placeholder: "Ex: São José dos Campos, Jacareí, Taubaté e região" },
  { key: "prazo_pagamento", label: "Prazo de Pagamento", type: "text", required: false, placeholder: "Ex: Pessoa Física: 3 dias | Pessoa Jurídica: 7 dias" },
  { key: "desconto_maximo", label: "Desconto Máximo (%)", type: "number", required: false, placeholder: "Ex: 5" },
];

globalProductsRouter.post("/generate-specialists", requireRole("super_admin"), async (_req, res, next) => {
  try {
    // Get all distinct categories that have at least one active global product
    const categoryRows = await prisma.product.findMany({
      where: { isGlobal: true, isActive: true },
      select: { category: true, name: true },
      distinct: ["category"],
    });

    if (categoryRows.length === 0) {
      res.status(400).json({ error: "Nenhum produto no catálogo global. Importe produtos primeiro." });
      return;
    }

    // For each category, get all product names (for keyword generation)
    const productsByCategory = await prisma.product.groupBy({
      by: ["category"],
      where: { isGlobal: true, isActive: true },
      _count: { id: true },
    });
    const productNamesByCategory = await Promise.all(
      productsByCategory.map(async (g) => {
        const names = await prisma.product.findMany({
          where: { isGlobal: true, isActive: true, category: g.category },
          select: { name: true },
          take: 20,
        });
        return { category: g.category, names: names.map((n) => n.name), count: g._count.id };
      })
    );

    const created: string[] = [];
    const updated: string[] = [];

    for (const { category, names } of productNamesByCategory) {
      const templateName = `Especialista em ${category}`;
      const prompt = buildSpecialistPrompt(category);
      const keywords = buildKeywordsForCategory(category, names);

      // Check if template already exists
      const existing = await prisma.agent.findFirst({
        where: { isTemplate: true, name: templateName },
        select: { id: true },
      });

      if (existing) {
        await prisma.agent.update({
          where: { id: existing.id },
          data: {
            prompt,
            triggerKeywords: keywords,
            dynamicFields: SPECIALIST_DYNAMIC_FIELDS,
            dynamicValues: { categoria: category },
            description: `Especialista comercial para a categoria ${category}. Apresenta produtos, calcula orçamentos e fecha negócios.`,
          },
        });
        updated.push(templateName);
      } else {
        await prisma.agent.create({
          data: {
            name: templateName,
            description: `Especialista comercial para a categoria ${category}. Apresenta produtos, calcula orçamentos e fecha negócios.`,
            type: "specialist",
            scope: "external",
            prompt,
            triggerKeywords: keywords,
            dynamicFields: SPECIALIST_DYNAMIC_FIELDS,
            dynamicValues: { categoria: category },
            isTemplate: true,
            isActive: true,
            autoActivate: false,
            companyId: null,
          },
        });
        created.push(templateName);
      }
    }

    res.json({
      created: created.length,
      updated: updated.length,
      createdNames: created,
      updatedNames: updated,
      categories: productNamesByCategory.map((p) => p.category),
    });
  } catch (err) { next(err); }
});

// ── Company product selection ─────────────────────────────────────

globalProductsRouter.get("/my-products", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) { res.status(403).json({ error: "Apenas empresas" }); return; }
    const items = await prisma.companyProduct.findMany({
      where: { companyId, isActive: true },
      include: { product: true },
      orderBy: { product: { name: "asc" } },
    });
    const data = items.map((i) => ({
      ...i.product,
      companyDailyPrice: i.dailyPrice,
      companyWeeklyPrice: i.weeklyPrice,
      companyMonthlyPrice: i.monthlyPrice,
    }));
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
});

const priceOverrideSchema = z.object({
  dailyPrice: z.number().min(0).nullable().optional(),
  weeklyPrice: z.number().min(0).nullable().optional(),
  monthlyPrice: z.number().min(0).nullable().optional(),
});

globalProductsRouter.post("/select/:productId", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) { res.status(403).json({ error: "Apenas empresas" }); return; }

    const product = await prisma.product.findUnique({ where: { id: req.params.productId, isGlobal: true, isActive: true } });
    if (!product) { res.status(404).json({ error: "Produto não encontrado no catálogo global" }); return; }

    const parsed = priceOverrideSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const cp = await prisma.companyProduct.upsert({
      where: { companyId_productId: { companyId, productId: req.params.productId } },
      create: { companyId, productId: req.params.productId, isActive: true, ...parsed.data },
      update: { isActive: true, ...parsed.data },
      include: { product: true },
    });
    res.status(201).json(cp);
  } catch (err) { next(err); }
});

globalProductsRouter.patch("/select/:productId", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) { res.status(403).json({ error: "Apenas empresas" }); return; }

    const parsed = priceOverrideSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const cp = await prisma.companyProduct.update({
      where: { companyId_productId: { companyId, productId: req.params.productId } },
      data: parsed.data,
      include: { product: true },
    });
    res.json(cp);
  } catch (err) { next(err); }
});

globalProductsRouter.delete("/select/:productId", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) { res.status(403).json({ error: "Apenas empresas" }); return; }
    await prisma.companyProduct.update({
      where: { companyId_productId: { companyId, productId: req.params.productId } },
      data: { isActive: false },
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── Product suggestions ───────────────────────────────────────────

const suggestionSchema = z.object({
  name: z.string().min(2).max(200),
  category: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  dailyPrice: z.number().min(0),
  weeklyPrice: z.number().min(0).nullable().optional(),
  monthlyPrice: z.number().min(0).nullable().optional(),
});

globalProductsRouter.get("/suggestions", async (req: AuthRequest, res, next) => {
  try {
    const isSuperAdmin = req.user?.role === "super_admin";
    const suggestions = await prisma.productSuggestion.findMany({
      where: isSuperAdmin ? {} : { companyId: req.user!.companyId! },
      include: { company: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: suggestions, total: suggestions.length });
  } catch (err) { next(err); }
});

globalProductsRouter.post("/suggestions", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) { res.status(403).json({ error: "Apenas empresas podem sugerir produtos" }); return; }

    const parsed = suggestionSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const suggestion = await prisma.productSuggestion.create({
      data: { ...parsed.data, companyId, status: "pending" },
    });
    res.status(201).json(suggestion);
  } catch (err) { next(err); }
});

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().max(500).optional(),
});

globalProductsRouter.patch("/suggestions/:id/review", requireRole("super_admin"), async (req, res, next) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const suggestion = await prisma.productSuggestion.findUnique({ where: { id: req.params.id } });
    if (!suggestion) { res.status(404).json({ error: "Sugestão não encontrada" }); return; }
    if (suggestion.status !== "pending") { res.status(409).json({ error: "Sugestão já revisada" }); return; }

    let approvedProductId: string | undefined;

    if (parsed.data.status === "approved") {
      const prices: Record<string, number> = {};
      if (suggestion.dailyPrice) prices["1"] = Number(suggestion.dailyPrice);
      if (suggestion.weeklyPrice) prices["7"] = Number(suggestion.weeklyPrice);
      if (suggestion.monthlyPrice) prices["28"] = Number(suggestion.monthlyPrice);

      const newProduct = await prisma.product.create({
        data: {
          name: suggestion.name,
          category: suggestion.category,
          description: suggestion.description,
          prices,
          dailyPrice: suggestion.dailyPrice,
          weeklyPrice: suggestion.weeklyPrice,
          monthlyPrice: suggestion.monthlyPrice,
          isGlobal: true,
          companyId: null,
        },
      });
      approvedProductId = newProduct.id;

      await prisma.companyProduct.create({
        data: { companyId: suggestion.companyId, productId: newProduct.id, isActive: true },
      });
    }

    const updated = await prisma.productSuggestion.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status, reviewNote: parsed.data.reviewNote, approvedProductId },
    });

    res.json(updated);
  } catch (err) { next(err); }
});
