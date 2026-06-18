import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const agentsRouter: ExpressRouter = Router();

const collectFieldsSchema = z.object({
  standard: z.array(z.string()),
  custom: z.array(z.object({
    key: z.string().min(1).max(64),
    label: z.string().min(1).max(100),
    description: z.string().max(200).optional(),
  })),
}).nullable().optional();

const agentSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  type: z.string().min(2).max(50),
  scope: z.enum(["external", "internal"]).default("external"),
  prompt: z.string().max(12000).default(""),
  triggerKeywords: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isPrivate: z.boolean().default(false).optional(),
  aiProvider: z.string().max(50).nullable().optional(),
  aiModel: z.string().max(100).nullable().optional(),
  collectFields: collectFieldsSchema,
});

/** Map well-known variable names to company fields for auto-fill. */
function companyAutoFill(company: { name: string; slug: string }): Record<string, string> {
  return {
    company_name: company.name,
    nome_empresa: company.name,
    empresa: company.name,
    nome: company.name,
    slug: company.slug,
  };
}

agentsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const isSuperAdmin = req.user?.role === "super_admin";
    const companyId = isSuperAdmin ? undefined : req.user?.companyId;

    const agents = await prisma.agent.findMany({
      where: {
        isTemplate: false,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        ...(isSuperAdmin ? { company: { select: { id: true, name: true, slug: true } } } : {}),
        phonePermissions: { select: { id: true, phone: true, label: true } },
      },
      orderBy: [{ companyId: "asc" }, { type: "asc" }, { name: "asc" }],
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
    const existing = await prisma.agent.findUnique({ where: { id: req.params.id }, select: { companyId: true, type: true } });
    if (!existing) { res.status(404).json({ error: "Agente não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && existing.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    // Company admins cannot deactivate the orchestrator — it is mandatory
    if (req.user?.role !== "super_admin" && existing.type === "orchestrator" && parsed.data.isActive === false) {
      res.status(403).json({ error: "O agente orquestrador é obrigatório e não pode ser desativado" }); return;
    }
    const agent = await prisma.agent.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(agent);
  } catch (err) { next(err); }
});

agentsRouter.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.agent.findUnique({ where: { id: req.params.id }, select: { companyId: true, type: true } });
    if (!existing) { res.status(404).json({ error: "Agente não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && existing.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    // Company admins cannot delete the orchestrator
    if (req.user?.role !== "super_admin" && existing.type === "orchestrator") {
      res.status(403).json({ error: "O agente orquestrador é obrigatório e não pode ser removido" }); return;
    }
    await prisma.agent.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── Prompt version history (super_admin only write, anyone can read) ──────────

agentsRouter.get("/:id/prompt-versions", async (req: AuthRequest, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!agent) { res.status(404).json({ error: "Agente não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && agent.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const versions = await prisma.agentPromptVersion.findMany({
      where: { agentId: req.params.id },
      orderBy: { version: "desc" },
      take: 50,
    });
    res.json(versions);
  } catch (err) { next(err); }
});

// Save a new prompt version — super_admin only
agentsRouter.post("/:id/prompt-versions", async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== "super_admin") {
      res.status(403).json({ error: "Apenas administradores da plataforma podem editar o prompt diretamente" });
      return;
    }
    const { prompt, label, keywords } = req.body as { prompt: string; label?: string; keywords?: string[] };
    if (!prompt?.trim()) { res.status(400).json({ error: "prompt é obrigatório" }); return; }

    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      select: { promptVersion: true },
    });
    if (!agent) { res.status(404).json({ error: "Agente não encontrado" }); return; }

    const nextVersion = agent.promptVersion + 1;
    const [version] = await prisma.$transaction([
      prisma.agentPromptVersion.create({
        data: { agentId: req.params.id, version: nextVersion, prompt: prompt.trim(), label: label?.trim() || null },
      }),
      prisma.agent.update({
        where: { id: req.params.id },
        data: {
          prompt: prompt.trim(),
          promptVersion: nextVersion,
          ...(keywords !== undefined ? { triggerKeywords: keywords } : {}),
        },
      }),
    ]);
    res.status(201).json(version);
  } catch (err) { next(err); }
});

// Restore a previous version — super_admin only
agentsRouter.post("/:id/prompt-versions/:versionId/restore", async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== "super_admin") {
      res.status(403).json({ error: "Apenas administradores da plataforma podem restaurar versões" });
      return;
    }
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      select: { promptVersion: true },
    });
    if (!agent) { res.status(404).json({ error: "Agente não encontrado" }); return; }

    const source = await prisma.agentPromptVersion.findUnique({ where: { id: req.params.versionId } });
    if (!source || source.agentId !== req.params.id) {
      res.status(404).json({ error: "Versão não encontrada" }); return;
    }

    const nextVersion = agent.promptVersion + 1;
    const [restored] = await prisma.$transaction([
      prisma.agentPromptVersion.create({
        data: {
          agentId: req.params.id,
          version: nextVersion,
          prompt: source.prompt,
          label: `Restaurado da v${source.version}${source.label ? ` (${source.label})` : ""}`,
        },
      }),
      prisma.agent.update({
        where: { id: req.params.id },
        data: { prompt: source.prompt, promptVersion: nextVersion },
      }),
    ]);
    res.status(201).json(restored);
  } catch (err) { next(err); }
});

// ── Dynamic values — company admin self-service ────────────────────────────────

/**
 * Returns the agent's dynamic field definitions + current values pre-filled
 * with company data for known variable names (auto-fill).
 */
agentsRouter.get("/:id/dynamic-values", async (req: AuthRequest, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: { company: { select: { name: true, slug: true } } },
    });
    if (!agent) { res.status(404).json({ error: "Agente não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && agent.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const stored = (agent.dynamicValues ?? {}) as Record<string, string>;
    const auto = agent.company ? companyAutoFill(agent.company) : {};

    // Merge: stored values win over auto-fill (company may have customized them)
    const values: Record<string, string> = {};
    const fields = (agent.dynamicFields ?? []) as Array<{ key: string }>;
    for (const f of fields) {
      values[f.key] = stored[f.key] || auto[f.key] || "";
    }

    res.json({ fields: agent.dynamicFields, values, autoFill: auto, templateId: agent.templateId });
  } catch (err) { next(err); }
});

/**
 * Company admin updates dynamic values. Re-interpolates the prompt from the
 * original template so no hardcoded values become stale.
 */
agentsRouter.patch("/:id/dynamic-values", async (req: AuthRequest, res, next) => {
  try {
    const { values } = req.body as { values: Record<string, string> };
    if (!values || typeof values !== "object") {
      res.status(400).json({ error: "values é obrigatório" }); return;
    }

    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      select: { companyId: true, promptVersion: true, templateId: true, prompt: true },
    });
    if (!agent) { res.status(404).json({ error: "Agente não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && agent.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    // Re-interpolate from the original template prompt so {{vars}} stay consistent
    let newPrompt = agent.prompt;
    if (agent.templateId) {
      const template = await prisma.agent.findUnique({
        where: { id: agent.templateId },
        select: { prompt: true },
      });
      if (template) {
        newPrompt = template.prompt;
        for (const [key, value] of Object.entries(values)) {
          newPrompt = newPrompt.replaceAll(`{{${key}}}`, value);
        }
      }
    }

    const nextVersion = agent.promptVersion + 1;
    const [version] = await prisma.$transaction([
      prisma.agentPromptVersion.create({
        data: {
          agentId: req.params.id,
          version: nextVersion,
          prompt: newPrompt,
          label: "Campos dinâmicos atualizados pela empresa",
        },
      }),
      prisma.agent.update({
        where: { id: req.params.id },
        data: { prompt: newPrompt, promptVersion: nextVersion, dynamicValues: values },
      }),
    ]);

    res.json(version);
  } catch (err) { next(err); }
});

// ── Phone permissions (whitelist for private agents) ───────────────────────────

agentsRouter.get("/:id/phone-permissions", async (req: AuthRequest, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!agent) { res.status(404).json({ error: "Agente não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && agent.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const permissions = await prisma.agentPhonePermission.findMany({
      where: { agentId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    res.json(permissions);
  } catch (err) { next(err); }
});

/** Replace the entire phone whitelist for an agent. */
agentsRouter.put("/:id/phone-permissions", async (req: AuthRequest, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!agent) { res.status(404).json({ error: "Agente não encontrado" }); return; }
    if (req.user?.role !== "super_admin" && agent.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const { phones } = req.body as { phones: Array<{ phone: string; label?: string }> };
    if (!Array.isArray(phones)) { res.status(400).json({ error: "phones deve ser um array" }); return; }

    const ops: Parameters<typeof prisma.$transaction>[0] = [
      prisma.agentPhonePermission.deleteMany({ where: { agentId: req.params.id } }),
    ];
    if (phones.length > 0) {
      ops.push(
        prisma.agentPhonePermission.createMany({
          data: phones.map((p) => ({
            agentId: req.params.id,
            phone: p.phone.trim().replace(/\s/g, ""),
            label: p.label?.trim() || null,
          })),
          skipDuplicates: true,
        })
      );
    }
    await prisma.$transaction(ops);

    const result = await prisma.agentPhonePermission.findMany({ where: { agentId: req.params.id } });
    res.json(result);
  } catch (err) { next(err); }
});
