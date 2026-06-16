import { Router, type Router as ExpressRouter } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

export const usersRouter: ExpressRouter = Router();

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["super_admin", "company_admin", "manager", "commercial", "operator"]),
  companyId: z.string().optional(),
});

usersRouter.get("/", async (req: AuthRequest, res) => {
  const companyId = req.user?.companyId;
  const users = await prisma.user.findMany({
    where: companyId ? { companyId } : {},
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, tokensUsed: true },
  });
  res.json(users);
});

usersRouter.post("/", requireRole("super_admin", "company_admin"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { password, ...data } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { ...data, passwordHash },
    select: { id: true, name: true, email: true, role: true },
  });
  res.status(201).json(user);
});

usersRouter.patch("/:id", async (req, res) => {
  const { password, ...data } = req.body;
  const update: Record<string, unknown> = { ...data };
  if (password) update.passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: update,
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  res.json(user);
});
