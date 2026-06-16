import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  req.requestId = randomUUID().slice(0, 8);
  req.startTime = Date.now();

  res.setHeader("X-Request-Id", req.requestId);

  res.on("finish", () => {
    const ms = Date.now() - req.startTime;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`, {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ms,
      ip: req.ip,
      ua: req.headers["user-agent"]?.slice(0, 80),
    });
  });

  next();
}
