import type { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "./auth.js";

/**
 * Garante que toda requisição autenticada opera dentro
 * do escopo da empresa correta (tenant isolation).
 *
 * super_admin → acesso a todas as empresas
 * demais roles → forçam companyId do próprio usuário
 */
export async function tenantGuard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  // super_admin pode passar companyId via query/body/param
  if (req.user.role === "super_admin") {
    next();
    return;
  }

  // Para todos os outros, o companyId vem do token JWT — nunca do request
  const companyId = req.user.companyId;
  if (!companyId) {
    res.status(403).json({ error: "Usuário sem empresa associada" });
    return;
  }

  // Verifica se empresa está ativa e dentro do limite de usuários
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { isActive: true, tokenLimit: true, tokensUsed: true },
  });

  if (!company || !company.isActive) {
    res.status(403).json({ error: "Empresa inativa ou não encontrada" });
    return;
  }

  // Injeta companyId no body e query para todas as rotas
  req.body.companyId = companyId;
  (req.query as Record<string, string>).companyId = companyId;

  next();
}
