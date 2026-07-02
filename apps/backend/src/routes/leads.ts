import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const leadsRouter: ExpressRouter = Router();

const createSchema = z.object({
  phone: z.string().min(1).max(30),
  name: z.string().min(1).max(200).optional(),
  companyName: z.string().max(200).optional(),
  document: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  neighborhood: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  state: z.string().max(10).optional(),
  source: z.string().max(100).default("manual"),
  leadOrigin: z.string().max(200).optional(),
  stage: z.enum(["new", "qualifying", "proposal", "negotiation", "won", "lost"]).default("new"),
  temperature: z.enum(["cold", "warm", "hot"]).default("warm"),
  notes: z.string().max(2000).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().min(1).max(30).optional(),
  companyName: z.string().max(200).nullable().optional(),
  document: z.string().max(30).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  neighborhood: z.string().max(200).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  state: z.string().max(10).nullable().optional(),
  source: z.string().max(100).optional(),
  leadOrigin: z.string().max(200).nullable().optional(),
  stage: z.enum(["new", "qualifying", "proposal", "negotiation", "won", "lost"]).optional(),
  temperature: z.enum(["cold", "warm", "hot"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

leadsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.role === "super_admin" ? undefined : req.user?.companyId;
    const page = Math.max(1, parseInt(String(req.query.page ?? 1)));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 50))));
    const q = req.query.q ? String(req.query.q).trim() : undefined;

    const where = {
      ...(companyId ? { companyId } : {}),
      ...(req.query.stage ? { stage: String(req.query.stage) } : {}),
      ...(req.query.temperature ? { temperature: String(req.query.temperature) } : {}),
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
          { companyName: { contains: q, mode: "insensitive" as const } },
          { document: { contains: q } },
          { city: { contains: q, mode: "insensitive" as const } },
        ],
      } : {}),
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
  } catch (err) { next(err); }
});

leadsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { conversations: true, quotes: true } },
        conversations: {
          select: { id: true, isActive: true, handedOffToHuman: true, createdAt: true, updatedAt: true, _count: { select: { messages: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!lead) { res.status(404).json({ error: "Lead não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && lead.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    res.json(lead);
  } catch (err) { next(err); }
});

leadsRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) { res.status(403).json({ error: "Apenas empresas podem criar leads" }); return; }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const existing = await prisma.lead.findUnique({
      where: { companyId_phone: { companyId, phone: parsed.data.phone } },
    });
    if (existing) { res.status(409).json({ error: "Já existe um lead com esse telefone nesta empresa" }); return; }

    const lead = await prisma.lead.create({ data: { ...parsed.data, companyId } });
    res.status(201).json(lead);
  } catch (err) { next(err); }
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
  } catch (err) { next(err); }
});

leadsRouter.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!existing) { res.status(404).json({ error: "Lead não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && existing.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});
