import { Router, type Router as ExpressRouter } from "express";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { authenticate, issueToken, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";
import { logger } from "../lib/logger.js";

export const authRouter: ExpressRouter = Router();

// Strict rate limit for login — 10 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Muitas tentativas de login. Tente novamente em 15 minutos." });
  },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    // Constant-time response to prevent user enumeration
    if (!user || !user.isActive) {
      await bcrypt.hash("dummy-prevent-timing-attack", 12);
      res.status(401).json({ error: "Credenciais inválidas" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logger.warn("Failed login attempt", { email, ip: req.ip, requestId: req.requestId });
      res.status(401).json({ error: "Credenciais inválidas" });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Embed role + companyId in token to avoid DB lookups on every request
    const token = issueToken({
      userId: user.id,
      role: user.role,
      companyId: user.companyId ?? undefined,
    });

    logger.info("User logged in", { userId: user.id, role: user.role, requestId: req.requestId });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Returns current user from token — no DB hit needed
authRouter.get("/me", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, email: true, role: true, companyId: true, isActive: true, lastLoginAt: true },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Usuário não encontrado ou inativo" });
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});
