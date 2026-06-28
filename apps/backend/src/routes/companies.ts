import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { requireRole, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const companiesRouter: ExpressRouter = Router();

const createSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug: apenas letras minúsculas, números e hífens"),
  plan: z.enum(["trial", "basic", "pro", "enterprise"]).default("trial"),
  tokenLimit: z.number().int().min(0).default(1_000_000),
  userLimit: z.number().int().min(1).default(10),
});

const metadataSchema = z.object({
  nomeFantasia:            z.string().max(300).optional(),
  razaoSocial:             z.string().max(300).optional(),
  cnpj:                    z.string().max(20).optional(),
  enderecoSede:            z.string().max(500).optional(),
  linkMaps:                z.string().max(1000).optional(),
  telefoneContato:         z.string().max(30).optional(),
  whatsappNumero:          z.string().max(30).optional(),
  website:                 z.string().max(300).optional(),
  proprietarioResponsavel: z.string().max(200).optional(),
  ramoAtuacao:             z.string().max(200).optional(),
  fundacao:                z.string().max(50).optional(),
  socios:                  z.string().max(1000).optional(),
  // G.AI config
  tomDeVoz:                z.string().max(1000).optional(),
  mensagemBoasVindas:      z.string().max(2000).optional(),
  assinaturaIA:            z.string().max(300).optional(),
  prioridadeAtendimento:   z.string().max(1000).optional(),
}).partial();

const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  plan: z.enum(["trial", "basic", "pro", "enterprise"]).optional(),
  isActive: z.boolean().optional(),
  tokenLimit: z.number().int().min(0).optional(),
  userLimit: z.number().int().min(1).optional(),
  whatsappPhoneNumberId: z.string().max(50).optional(),
  whatsappToken:         z.string().max(512).optional(),
  whatsappProvider:      z.enum(["360dialog", "evolution"]).optional(),
  evolutionApiUrl:       z.string().max(500).nullish(),
  evolutionApiKey:       z.string().max(512).nullish(),
  evolutionInstance:     z.string().max(200).nullish(),
  aiProvider:            z.string().max(50).optional(),
  aiModel:               z.string().max(100).optional(),
  primaryColor:          z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  metadata:              metadataSchema.optional(),
});

companiesRouter.get("/", requireRole("super_admin"), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? 1)));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 50))));
    const skip = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search) : undefined;

    const where = search ? { name: { contains: search, mode: "insensitive" as const } } : {};

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: { select: { users: true, leads: true, conversations: true, agents: true } },
        },
      }),
      prisma.company.count({ where }),
    ]);

    res.json({ data: companies, total, page, limit });
  } catch (err) {
    next(err);
  }
});

companiesRouter.post("/", requireRole("super_admin"), async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const company = await prisma.company.create({ data: parsed.data });

    // Auto-activate all templates flagged with autoActivate for the new company
    const autoTemplates = await prisma.agent.findMany({
      where: { isTemplate: true, isActive: true, autoActivate: true },
    });

    if (autoTemplates.length > 0) {
      await prisma.agent.createMany({
        data: autoTemplates.map((t) => ({
          companyId: company.id,
          templateId: t.id,
          isTemplate: false,
          name: t.name,
          description: t.description,
          type: t.type,
          scope: t.scope,
          prompt: t.prompt,
          triggerKeywords: t.triggerKeywords,
          dynamicFields: t.dynamicFields as object[],
          dynamicValues: {},
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }

    res.status(201).json(company);
  } catch (err) {
    next(err);
  }
});

companiesRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
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

    // Never expose credentials in responses
    const { whatsappToken: _t, evolutionApiKey: _e, ...safe } = company as typeof company & { whatsappToken?: string; evolutionApiKey?: string };
    res.json(safe);
  } catch (err) {
    next(err);
  }
});

companiesRouter.patch("/:id", async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (req.user?.role !== "super_admin" && req.user?.companyId !== id) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const company = await prisma.company.update({ where: { id }, data: parsed.data });
    const { whatsappToken: _t, ...safe } = company as typeof company & { whatsappToken?: string };
    res.json(safe);
  } catch (err) {
    next(err);
  }
});

companiesRouter.get("/:id/users", async (req: AuthRequest, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

companiesRouter.get("/:id/agents", async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (req.user?.role !== "super_admin" && req.user?.companyId !== id) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const agents = await prisma.agent.findMany({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: agents, total: agents.length });
  } catch (err) {
    next(err);
  }
});

// Register (or update) the 360dialog webhook URL for a company
companiesRouter.post("/:id/register-webhook", requireRole("super_admin"), async (req: AuthRequest, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      select: { slug: true, whatsappToken: true },
    });
    if (!company) { res.status(404).json({ error: "Empresa não encontrada" }); return; }
    if (!company.whatsappToken) { res.status(422).json({ error: "Configure a 360dialog API Key antes de registrar o webhook" }); return; }

    const baseUrl = (process.env.BACKEND_PUBLIC_URL ?? "").replace(/\/$/, "");
    if (!baseUrl) { res.status(500).json({ error: "BACKEND_PUBLIC_URL não configurada no .env" }); return; }

    const webhookUrl = `${baseUrl}/webhook/${company.slug}`;
    const dialog360Base = (process.env.DIALOG_360_BASE_URL ?? "https://waba-sandbox.360dialog.io").replace(/\/$/, "");

    const response = await fetch(`${dialog360Base}/v1/configs/webhook`, {
      method: "POST",
      headers: {
        "D360-API-KEY": company.whatsappToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(502).json({ error: "360dialog retornou erro", detail: body });
      return;
    }

    res.json({ webhookUrl, dialog360Response: body });
  } catch (err) {
    next(err);
  }
});

companiesRouter.get("/:id/stats", async (req: AuthRequest, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});
