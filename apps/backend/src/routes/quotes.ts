import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";

export const quotesRouter: ExpressRouter = Router();

quotesRouter.get("/", async (req: AuthRequest, res) => {
  const companyId = req.user?.companyId;
  const quotes = await prisma.quote.findMany({
    where: { ...(companyId ? { companyId } : {}) },
    orderBy: { createdAt: "desc" },
    include: { items: true, lead: true },
  });
  res.json(quotes);
});

quotesRouter.post("/", async (req: AuthRequest, res) => {
  const companyId = req.user?.companyId ?? req.body.companyId;
  const { items, ...quoteData } = req.body;

  const quote = await prisma.quote.create({
    data: {
      ...quoteData,
      companyId,
      items: { create: items ?? [] },
    },
    include: { items: true },
  });

  res.status(201).json(quote);
});

quotesRouter.patch("/:id", async (req, res) => {
  const quote = await prisma.quote.update({ where: { id: req.params.id }, data: req.body });
  res.json(quote);
});
