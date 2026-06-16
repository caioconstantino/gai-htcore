import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const agentsRouter: ExpressRouter = Router();

const agentSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  type: z.string().min(2).max(50),
  scope: z.enum(["external", "internal"]).default("external"),
  prompt: z.string().max(8000).default(""),
  triggerKeywords: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

agentsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.role === "super_admin" ? undefined : req.user?.companyId;
    const agents = await prisma.agent.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { name: "asc" },
    });
    res.json({ data: agents, total: agents.length });
  } catch (err) { next(err); }
});

agentsRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const parsed = agentSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const companyId = req.user?.companyId ?? req.body.companyId;
    if (!companyId) { res.status(400).json({ error: "companyId é obrigatório" }); return; }
    const agent = await prisma.agent.create({ data: { ...parsed.data, companyId } });
    res.status(201).json(agent);
  } catch (err) { next(err); }
});

agentsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
    if (!agent) { res.status(404).json({ error: "Agente não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && agent.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    res.json(agent);
  } catch (err) { next(err); }
});

agentsRouter.patch("/:id", async (req: AuthRequest, res, next) => {
  try {
    const parsed = agentSchema.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const existing = await prisma.agent.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!existing) { res.status(404).json({ error: "Agente não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && existing.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const agent = await prisma.agent.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(agent);
  } catch (err) { next(err); }
});

agentsRouter.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.agent.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!existing) { res.status(404).json({ error: "Agente não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && existing.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    await prisma.agent.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});
