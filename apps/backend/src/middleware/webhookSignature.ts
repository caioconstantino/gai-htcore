import type { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "../lib/logger.js";

/**
 * Validates Meta's X-Hub-Signature-256 header.
 * Must be applied BEFORE express.json() parses the body —
 * use express.raw() on the webhook route so we get the raw buffer.
 */
export function verifyMetaSignature(req: Request, res: Response, next: NextFunction): void {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // Skip validation if secret not configured (dev mode)
  if (!appSecret) {
    logger.warn("WHATSAPP_APP_SECRET not set — skipping webhook signature validation");
    next();
    return;
  }

  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  if (!signature) {
    logger.warn("Webhook request missing X-Hub-Signature-256", { ip: req.ip });
    res.sendStatus(403);
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    res.sendStatus(400);
    return;
  }

  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;

  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      logger.warn("Webhook signature mismatch", { ip: req.ip });
      res.sendStatus(403);
      return;
    }
  } catch {
    res.sendStatus(403);
    return;
  }

  next();
}
