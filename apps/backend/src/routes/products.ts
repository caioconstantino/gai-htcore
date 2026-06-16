import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const productsRouter: ExpressRouter = Router();

const productSchema = z.object({
  name: z.string().min(2).max(200),
  category: z.string().min(2).max(100),
  description: z.string().max(2000).optional(),
  dailyPrice: z.number().min(0),
  weeklyPrice: z.number().min(0).nullable().optional(),
  monthlyPrice: z.number().min(0).nullable().optional(),
  isActive: z.boolean().default(true),
  isMostSold: z.boolean().default(false),
  isHighRevenue: z.boolean().default(false),
});

productsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.role === "super_admin"
      ? (req.query.companyId as string | undefined)
      : req.user?.companyId;

    const showInactive = req.query.showInactive === "true";

    const products = await prisma.product.findMany({
      where: { ...(companyId ? { companyId } : {}), ...(showInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
    });
    res.json({ data: products, total: products.length });
  } catch (err) { next(err); }
});

productsRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const companyId = req.user?.companyId ?? req.body.companyId;
    if (!companyId) { res.status(400).json({ error: "companyId é obrigatório" }); return; }
    const product = await prisma.product.create({ data: { ...parsed.data, companyId } });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

productsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) { res.status(404).json({ error: "Produto não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && product.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    res.json(product);
  } catch (err) { next(err); }
});

productsRouter.patch("/:id", async (req: AuthRequest, res, next) => {
  try {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const existing = await prisma.product.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!existing) { res.status(404).json({ error: "Produto não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && existing.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const product = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(product);
  } catch (err) { next(err); }
});

productsRouter.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!existing) { res.status(404).json({ error: "Produto não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && existing.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).send();
  } catch (err) { next(err); }
});
