import type { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "../lib/logger.js";

/**
 * Validates 360dialog's X-Hub-Signature-256 webhook signature.
 * 360dialog signs using HMAC-SHA256 with the company's D360-API-KEY as the secret.
 * In sandbox, signatures are not sent — validation is skipped automatically.
 */
export function verify360Signature(secret: string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!secret) {
      // Sandbox / unconfigured company — allow through
      next();
      return;
    }

    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    if (!signature) {
      // 360dialog sandbox doesn't send signatures — allow through
      next();
      return;
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.sendStatus(400);
      return;
    }

    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;

    try {
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        logger.warn("360dialog webhook signature mismatch", { ip: req.ip });
        res.sendStatus(403);
        return;
      }
    } catch {
      res.sendStatus(403);
      return;
    }

    next();
  };
}

// Keep backward-compatible export used in older code
export const verifyMetaSignature = verify360Signature(process.env.WHATSAPP_APP_SECRET);
