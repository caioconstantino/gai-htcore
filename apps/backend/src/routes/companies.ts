import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { requireRole, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const companiesRouter: ExpressRouter = Router();

const createSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  plan: z.enum(["trial", "basic", "pro", "enterprise"]).default("trial"),
  tokenLimit: z.number().int().default(1000000),
  userLimit: z.number().int().default(10),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  plan: z.enum(["trial", "basic", "pro", "enterprise"]).optional(),
  isActive: z.boolean().optional(),
  tokenLimit: z.number().int().optional(),
  userLimit: z.number().int().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  whatsappToken: z.string().optional(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
  primaryColor: z.string().optional(),
});

companiesRouter.get("/", requireRole("super_admin"), async (_req, res) => {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, leads: true, conversations: true, agents: true } },
    },
  });
  res.json({ data: companies, total: companies.length });
});

companiesRouter.post("/", requireRole("super_admin"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const company = await prisma.company.create({ data: parsed.data });
  res.status(201).json(company);
});

companiesRouter.get("/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user?.role !== "super_admin" && req.user?.companyId !== id) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      commercialRules: true,
      _count: { select: { users: true, leads: true, conversations: true, agents: true, products: true, quotes: true } },
    },
  });
  if (!company) { res.status(404).json({ error: "Empresa não encontrada" }); return; }
  res.json(company);
});

companiesRouter.patch("/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user?.role !== "super_admin" && req.user?.companyId !== id) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const company = await prisma.company.update({ where: { id }, data: parsed.data });
  res.json(company);
});

companiesRouter.get("/:id/users", async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user?.role !== "super_admin" && req.user?.companyId !== id) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }
  const users = await prisma.user.findMany({
    where: { companyId: id },
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, tokensUsed: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: users, total: users.length });
});

companiesRouter.get("/:id/agents", async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user?.role !== "super_admin" && req.user?.companyId !== id) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }
  const agents = await prisma.agent.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: agents, total: agents.length });
});

companiesRouter.get("/:id/stats", async (req: AuthRequest, res) => {
  const { id } = req.params;
  if (req.user?.role !== "super_admin" && req.user?.companyId !== id) {
    res.status(403).json({ error: "Acesso negado" }); return;
  }
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalLeads, hotLeads, activeConversations, totalQuotes, leadsByStage, tokenLogs] = await Promise.all([
    prisma.lead.count({ where: { companyId: id } }),
    prisma.lead.count({ where: { companyId: id, temperature: "hot" } }),
    prisma.conversation.count({ where: { companyId: id, isActive: true } }),
    prisma.quote.count({ where: { companyId: id } }),
    prisma.lead.groupBy({ by: ["stage"], where: { companyId: id }, _count: true }),
    prisma.tokenUsageLog.aggregate({
      where: { companyId: id, createdAt: { gte: thirtyDaysAgo } },
      _sum: { totalTokens: true },
    }),
  ]);

  res.json({ totalLeads, hotLeads, activeConversations, totalQuotes, leadsByStage, tokensLast30Days: tokenLogs._sum.totalTokens ?? 0 });
});
