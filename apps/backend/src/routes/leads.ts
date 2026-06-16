import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";

export const leadsRouter: ExpressRouter = Router();

leadsRouter.get("/", async (req: AuthRequest, res) => {
  const companyId = req.user?.companyId;
  const { stage, temperature, page = "1", limit = "20" } = req.query;

  const where = {
    ...(companyId ? { companyId } : {}),
    ...(stage ? { stage: stage as string } : {}),
    ...(temperature ? { temperature: temperature as string } : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { lastInteractionAt: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: { _count: { select: { conversations: true, quotes: true } } },
    }),
    prisma.lead.count({ where }),
  ]);

  res.json({ leads, total, page: Number(page), limit: Number(limit) });
});

leadsRouter.get("/:id", async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: {
      conversations: { include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } } },
      quotes: { include: { items: true } },
    },
  });
  if (!lead) { res.status(404).json({ error: "Lead não encontrado" }); return; }
  res.json(lead);
});

leadsRouter.patch("/:id", async (req, res) => {
  const lead = await prisma.lead.update({ where: { id: req.params.id }, data: req.body });
  res.json(lead);
});
