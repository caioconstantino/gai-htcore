import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";

export const productsRouter: ExpressRouter = Router();

productsRouter.get("/", async (req: AuthRequest, res) => {
  const companyId = req.user?.companyId ?? (req.query.companyId as string);
  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    orderBy: { name: "asc" },
  });
  res.json(products);
});

productsRouter.post("/", async (req: AuthRequest, res) => {
  const companyId = req.user?.companyId ?? req.body.companyId;
  const product = await prisma.product.create({ data: { ...req.body, companyId } });
  res.status(201).json(product);
});

productsRouter.get("/:id", async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) { res.status(404).json({ error: "Produto não encontrado" }); return; }
  res.json(product);
});

productsRouter.patch("/:id", async (req, res) => {
  const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
  res.json(product);
});

productsRouter.delete("/:id", async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.status(204).send();
});
