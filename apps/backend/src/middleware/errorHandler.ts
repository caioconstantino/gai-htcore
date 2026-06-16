import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
const { JsonWebTokenError, TokenExpiredError } = jwt;
import { logger } from "../lib/logger.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId ?? "unknown";

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Dados inválidos", details: err.flatten() });
    return;
  }

  // JWT errors
  if (err instanceof TokenExpiredError) {
    res.status(401).json({ error: "Token expirado" });
    return;
  }
  if (err instanceof JsonWebTokenError) {
    res.status(401).json({ error: "Token inválido" });
    return;
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const field = (err.meta?.target as string[])?.join(", ") ?? "campo";
      res.status(409).json({ error: `Conflito: ${field} já existe` });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Registro não encontrado" });
      return;
    }
    logger.error("Prisma error", { requestId, code: err.code, meta: err.meta });
    res.status(500).json({ error: "Erro de banco de dados" });
    return;
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.warn("Prisma validation error", { requestId });
    res.status(400).json({ error: "Dados inválidos para o banco de dados" });
    return;
  }

  // Generic errors
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error("Unhandled error", {
    requestId,
    message: error.message,
    stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
  });

  res.status(500).json({
    error: "Erro interno do servidor",
    ...(process.env.NODE_ENV !== "production" && { detail: error.message }),
  });
}
