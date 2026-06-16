import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { requireRole, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const globalProductsRouter: ExpressRouter = Router();

const productSchema = z.object({
  name: z.string().min(2).max(200),
  category: z.string().min(2).max(100),
  description: z.string().max(2000).optional(),
  dailyPrice: z.number().min(0),
  weeklyPrice: z.number().min(0).nullable().optional(),
  monthlyPrice: z.number().min(0).nullable().optional(),
  isMostSold: z.boolean().default(false),
  isHighRevenue: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const suggestionSchema = z.object({
  name: z.string().min(2).max(200),
  category: z.string().min(2).max(100),
  description: z.string().max(2000).optional(),
  dailyPrice: z.number().min(0),
  weeklyPrice: z.number().min(0).nullable().optional(),
  monthlyPrice: z.number().min(0).nullable().optional(),
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

    // If company user, annotate which products they already selected
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
    const product = await prisma.product.create({
      data: { ...parsed.data, isGlobal: true, companyId: null },
    });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

globalProductsRouter.patch("/:id", requireRole("super_admin"), async (req, res, next) => {
  try {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const product = await prisma.product.update({
      where: { id: req.params.id, isGlobal: true },
      data: parsed.data,
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
    res.json({ data: items.map((i) => i.product), total: items.length });
  } catch (err) { next(err); }
});

globalProductsRouter.post("/select/:productId", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) { res.status(403).json({ error: "Apenas empresas" }); return; }

    const product = await prisma.product.findUnique({ where: { id: req.params.productId, isGlobal: true, isActive: true } });
    if (!product) { res.status(404).json({ error: "Produto não encontrado no catálogo global" }); return; }

    const cp = await prisma.companyProduct.upsert({
      where: { companyId_productId: { companyId, productId: req.params.productId } },
      create: { companyId, productId: req.params.productId, isActive: true },
      update: { isActive: true },
    });
    res.status(201).json(cp);
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
      // Create as global product
      const newProduct = await prisma.product.create({
        data: {
          name: suggestion.name,
          category: suggestion.category,
          description: suggestion.description,
          dailyPrice: suggestion.dailyPrice,
          weeklyPrice: suggestion.weeklyPrice,
          monthlyPrice: suggestion.monthlyPrice,
          isGlobal: true,
          companyId: null,
        },
      });
      approvedProductId = newProduct.id;

      // Auto-select the approved product for the suggesting company
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
