import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { requireRole, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const rolesRouter: ExpressRouter = Router();

const roleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).default([]),
  isDefault: z.boolean().optional(),
});

rolesRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.role === "super_admin" ? req.query.companyId as string : req.user!.companyId;
    if (!companyId) { res.status(400).json({ error: "Sem empresa" }); return; }

    const roles = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT cr.id, cr."companyId", cr.name, cr.description, cr.permissions, cr."isDefault",
             cr."createdAt", cr."updatedAt",
             COUNT(u.id)::int AS "userCount"
      FROM company_roles cr
      LEFT JOIN users u ON u."customRoleId" = cr.id
      WHERE cr."companyId" = ${companyId}
      GROUP BY cr.id
      ORDER BY cr."createdAt" ASC
    `;
    res.json(roles);
  } catch (err) { next(err); }
});

rolesRouter.post("/", requireRole("super_admin", "company_admin"), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    if (!companyId) { res.status(400).json({ error: "Sem empresa" }); return; }

    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const { name, description, permissions, isDefault } = parsed.data;

    const [role] = await prisma.$queryRaw<Record<string, unknown>[]>`
      INSERT INTO company_roles ("companyId", name, description, permissions, "isDefault", "createdAt", "updatedAt")
      VALUES (${companyId}, ${name}, ${description ?? null}, ${permissions}::text[], ${isDefault ?? false}, NOW(), NOW())
      RETURNING *
    `;
    res.status(201).json(role);
  } catch (err) { next(err); }
});

rolesRouter.patch("/:id", requireRole("super_admin", "company_admin"), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const { id } = req.params;

    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM company_roles WHERE id = ${id} AND "companyId" = ${companyId}
    `;
    if (!existing.length) { res.status(404).json({ error: "Perfil não encontrado" }); return; }

    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

    const { name, description, permissions, isDefault } = parsed.data;

    const [updated] = await prisma.$queryRaw<Record<string, unknown>[]>`
      UPDATE company_roles
      SET name = ${name},
          description = ${description ?? null},
          permissions = ${permissions}::text[],
          "isDefault" = ${isDefault ?? false},
          "updatedAt" = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    res.json(updated);
  } catch (err) { next(err); }
});

rolesRouter.delete("/:id", requireRole("super_admin", "company_admin"), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const { id } = req.params;

    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM company_roles WHERE id = ${id} AND "companyId" = ${companyId}
    `;
    if (!existing.length) { res.status(404).json({ error: "Perfil não encontrado" }); return; }

    // Unlink users from this role before deleting
    await prisma.$executeRaw`UPDATE users SET "customRoleId" = NULL WHERE "customRoleId" = ${id}`;
    await prisma.$executeRaw`DELETE FROM company_roles WHERE id = ${id}`;
    res.status(204).send();
  } catch (err) { next(err); }
});
