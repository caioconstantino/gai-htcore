import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";

export const agentsRouter: ExpressRouter = Router();

agentsRouter.get("/", async (req: AuthRequest, res) => {
  const companyId = req.user?.companyId;
  const agents = await prisma.agent.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { name: "asc" },
  });
  res.json(agents);
});

agentsRouter.post("/", async (req: AuthRequest, res) => {
  const companyId = req.user?.companyId ?? req.body.companyId;
  const agent = await prisma.agent.create({ data: { ...req.body, companyId } });
  res.status(201).json(agent);
});

agentsRouter.get("/:id", async (req, res) => {
  const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
  if (!agent) { res.status(404).json({ error: "Agente não encontrado" }); return; }
  res.json(agent);
});

agentsRouter.patch("/:id", async (req, res) => {
  const agent = await prisma.agent.update({ where: { id: req.params.id }, data: req.body });
  res.json(agent);
});

agentsRouter.delete("/:id", async (req, res) => {
  await prisma.agent.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.status(204).send();
});
