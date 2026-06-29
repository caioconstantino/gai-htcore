import { Router, type Router as ExpressRouter } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { requireRole, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const usersRouter: ExpressRouter = Router();

const createSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["company_admin", "manager", "commercial", "operator"]),
  companyId: z.string().min(1).optional(),
  customRoleId: z.string().optional(),
});

const createSuperAdminSchema = createSchema.extend({
  role: z.enum(["super_admin", "company_admin", "manager", "commercial", "operator"]),
});

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(8).max(128).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["company_admin", "manager", "commercial", "operator"]).optional(),
  customRoleId: z.string().nullable().optional(),
});

usersRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? 1)));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 50))));
    const skip = (page - 1) * limit;

    const where = req.user?.role === "super_admin"
      ? {}
      : { companyId: req.user!.companyId };

    const companyFilter = req.user?.role === "super_admin" ? null : req.user!.companyId;
    const [users, total] = await Promise.all([
      prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT u.id, u.name, u.email, u.role, u."isActive", u."lastLoginAt",
               u."tokensUsed", u."companyId", u."createdAt", u."customRoleId",
               cr.name AS "customRoleName"
        FROM users u
        LEFT JOIN company_roles cr ON cr.id = u."customRoleId"
        WHERE (${companyFilter}::text IS NULL OR u."companyId" = ${companyFilter})
        ORDER BY u."createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `,
      prisma.user.count({ where }),
    ]);

    res.json({ data: users, total, page, limit });
  } catch (err) {
    next(err);
  }
});

usersRouter.post("/", requireRole("super_admin", "company_admin"), async (req: AuthRequest, res, next) => {
  try {
    const schema = req.user?.role === "super_admin" ? createSuperAdminSchema : createSchema;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { password, companyId, customRoleId, ...data } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);

    // company_admin can only create users in their own company
    const resolvedCompanyId = req.user?.role === "super_admin"
      ? companyId
      : req.user?.companyId;

    // Use raw SQL so customRoleId is set even before Prisma client is regenerated
    const [user] = await prisma.$queryRaw<Record<string, unknown>[]>`
      INSERT INTO users (id, "companyId", "customRoleId", name, email, "passwordHash", role, "isActive", "tokensUsed", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${resolvedCompanyId ?? null}, ${customRoleId ?? null}, ${data.name}, ${data.email}, ${passwordHash}, ${data.role}, true, 0, NOW(), NOW())
      RETURNING id, name, email, role, "companyId", "customRoleId", "isActive"
    `;
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch("/:id", async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Only super_admin can edit any user; others can only edit themselves
    const isSelf = req.user?.userId === id;
    const isAdmin = req.user?.role === "super_admin" || req.user?.role === "company_admin";

    if (!isSelf && !isAdmin) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    // company_admin cannot change role or companyId of users outside their company
    if (req.user?.role === "company_admin") {
      const target = await prisma.user.findUnique({ where: { id }, select: { companyId: true } });
      if (target?.companyId !== req.user.companyId) {
        res.status(403).json({ error: "Acesso negado" });
        return;
      }
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { password, customRoleId, ...data } = parsed.data;
    const update: Record<string, unknown> = { ...data };
    if (password) update.passwordHash = await bcrypt.hash(password, 12);

    // Handle customRoleId via raw SQL (field not yet in generated Prisma client)
    if (customRoleId !== undefined) {
      await prisma.$executeRaw`UPDATE users SET "customRoleId" = ${customRoleId} WHERE id = ${id}`;
    }

    const user = await prisma.user.update({
      where: { id },
      data: update,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.delete("/:id", requireRole("super_admin", "company_admin"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    if (req.user?.role === "company_admin") {
      if (req.user.userId === id) {
        res.status(400).json({ error: "Você não pode excluir sua própria conta" });
        return;
      }
      const target = await prisma.user.findUnique({ where: { id }, select: { companyId: true } });
      if (!target || target.companyId !== req.user.companyId) {
        res.status(403).json({ error: "Acesso negado" });
        return;
      }
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
