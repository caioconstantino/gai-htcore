import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const leadsRouter: ExpressRouter = Router();

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional(),
  stage: z.enum(["new", "qualifying", "proposal", "negotiation", "won", "lost"]).optional(),
  temperature: z.enum(["cold", "warm", "hot"]).optional(),
  notes: z.string().max(2000).optional(),
  source: z.string().max(100).optional(),
}).strict();

leadsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.role === "super_admin" ? undefined : req.user?.companyId;
    const page = Math.max(1, parseInt(String(req.query.page ?? 1)));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 20))));

    const where = {
      ...(companyId ? { companyId } : {}),
      ...(req.query.stage ? { stage: String(req.query.stage) } : {}),
      ...(req.query.temperature ? { temperature: String(req.query.temperature) } : {}),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { lastInteractionAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { conversations: true, quotes: true } } },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({ leads, total, page, limit });
  } catch (err) {
    next(err);
  }
});

leadsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        conversations: { include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } } },
        quotes: { include: { items: true } },
      },
    });
    if (!lead) { res.status(404).json({ error: "Lead não encontrado" }); return; }

    // Tenant check
    if (req.user?.role !== "super_admin" && lead.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    res.json(lead);
  } catch (err) {
    next(err);
  }
});

leadsRouter.patch("/:id", async (req: AuthRequest, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const existing = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!existing) { res.status(404).json({ error: "Lead não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && existing.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(lead);
  } catch (err) {
    next(err);
  }
});
