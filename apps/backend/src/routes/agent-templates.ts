import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { requireRole, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const agentTemplatesRouter: ExpressRouter = Router();

const dynamicFieldSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z_]+$/),
  label: z.string().min(1).max(100),
  type: z.enum(["text", "textarea", "number", "select"]),
  placeholder: z.string().max(200).optional(),
  description: z.string().max(300).optional(),
  options: z.array(z.string()).optional(), // for type=select
  required: z.boolean().default(true),
});

const templateSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  type: z.string().min(2).max(50),
  scope: z.enum(["external", "internal"]).default("external"),
  prompt: z.string().min(1).max(12000),
  triggerKeywords: z.array(z.string()).default([]),
  dynamicFields: z.array(dynamicFieldSchema).default([]),
  isActive: z.boolean().default(true),
  autoActivate: z.boolean().default(false).optional(),
  isPrivate: z.boolean().default(false).optional(),
  aiProvider: z.string().max(50).nullable().optional(),
  aiModel: z.string().max(100).nullable().optional(),
});

// All authenticated users can browse templates
agentTemplatesRouter.get("/", async (_req, res, next) => {
  try {
    const templates = await prisma.agent.findMany({
      where: { isTemplate: true },
      include: { _count: { select: { instances: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ data: templates, total: templates.length });
  } catch (err) { next(err); }
});

agentTemplatesRouter.get("/:id", async (req, res, next) => {
  try {
    const template = await prisma.agent.findUnique({
      where: { id: req.params.id, isTemplate: true },
      include: { _count: { select: { instances: true } } },
    });
    if (!template) { res.status(404).json({ error: "Template não encontrado" }); return; }
    res.json(template);
  } catch (err) { next(err); }
});

agentTemplatesRouter.post("/", requireRole("super_admin"), async (req, res, next) => {
  try {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const template = await prisma.agent.create({
      data: { ...parsed.data, isTemplate: true, companyId: null },
    });

    // Auto-activate: create an instance for every existing company
    if (template.autoActivate) {
      const companies = await prisma.company.findMany({ select: { id: true } });
      const existing = await prisma.agent.findMany({
        where: { templateId: template.id },
        select: { companyId: true },
      });
      const existingIds = new Set(existing.map((a) => a.companyId));

      await prisma.agent.createMany({
        data: companies
          .filter((c) => !existingIds.has(c.id))
          .map((c) => ({
            companyId: c.id,
            templateId: template.id,
            isTemplate: false,
            name: template.name,
            description: template.description,
            type: template.type,
            scope: template.scope,
            prompt: template.prompt,
            triggerKeywords: template.triggerKeywords,
            dynamicFields: template.dynamicFields as object[],
            dynamicValues: {},
            isActive: true,
          })),
        skipDuplicates: true,
      });
    }

    res.status(201).json(template);
  } catch (err) { next(err); }
});

agentTemplatesRouter.patch("/:id", requireRole("super_admin"), async (req, res, next) => {
  try {
    const parsed = templateSchema.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
    const template = await prisma.agent.update({
      where: { id: req.params.id, isTemplate: true },
      data: parsed.data,
    });
    res.json(template);
  } catch (err) { next(err); }
});

agentTemplatesRouter.delete("/:id", requireRole("super_admin"), async (req, res, next) => {
  try {
    // Soft delete — just deactivate so instances remain valid
    await prisma.agent.update({
      where: { id: req.params.id, isTemplate: true },
      data: { isActive: false },
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

// Company activates a template — fills in dynamic values
const activateSchema = z.object({
  templateId: z.string().min(1),
  dynamicValues: z.record(z.string()),
});

agentTemplatesRouter.post("/activate", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) { res.status(403).json({ error: "Apenas empresas podem ativar templates" }); return; }

    const parsed = activateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const { templateId, dynamicValues } = parsed.data;
    const template = await prisma.agent.findUnique({
      where: { id: templateId, isTemplate: true, isActive: true },
    });
    if (!template) { res.status(404).json({ error: "Template não encontrado ou inativo" }); return; }

    // Validate required dynamic fields
    const fields = template.dynamicFields as Array<{ key: string; required: boolean }>;
    const missing = fields.filter((f) => f.required && !dynamicValues[f.key]?.trim());
    if (missing.length > 0) {
      res.status(400).json({ error: `Campos obrigatórios não preenchidos: ${missing.map((f) => f.key).join(", ")}` });
      return;
    }

    // Substitute {{placeholders}} in prompt with dynamic values
    let resolvedPrompt = template.prompt;
    for (const [key, value] of Object.entries(dynamicValues)) {
      resolvedPrompt = resolvedPrompt.replaceAll(`{{${key}}}`, value);
    }

    // Check if company already has an active instance of this template
    const existing = await prisma.agent.findFirst({
      where: { companyId, templateId, isActive: true },
    });
    if (existing) {
      res.status(409).json({ error: "Sua empresa já possui este agente ativo. Edite ou desative o existente antes de reativar." });
      return;
    }

    const agent = await prisma.agent.create({
      data: {
        companyId,
        templateId,
        isTemplate: false,
        name: template.name,
        description: template.description,
        type: template.type,
        scope: template.scope,
        prompt: resolvedPrompt,
        triggerKeywords: template.triggerKeywords,
        dynamicFields: template.dynamicFields as object[],
        dynamicValues,
        isActive: true,
        isPrivate: template.isPrivate,
      },
    });

    res.status(201).json(agent);
  } catch (err) { next(err); }
});
