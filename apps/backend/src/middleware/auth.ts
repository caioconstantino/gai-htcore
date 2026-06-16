import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  role: string;
  companyId?: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token não fornecido" });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret()) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    // Let errorHandler classify TokenExpiredError vs JsonWebTokenError
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    next();
  };
}

export function issueToken(payload: JwtPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: "7d" });
}
