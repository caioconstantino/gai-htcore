import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { orchestrate } from "../orchestrator/index.js";
import { sendWhatsAppMessage } from "../whatsapp/sender.js";
import { logger } from "../lib/logger.js";
import { verifyMetaSignature } from "../middleware/webhookSignature.js";
import type { WhatsAppWebhookPayload } from "../types.js";

export const webhookRouter: ExpressRouter = Router();

// Parse raw body for HMAC validation — must come before express.json()
webhookRouter.use((req, _res, next) => {
  let data = Buffer.alloc(0);
  req.on("data", (chunk: Buffer) => { data = Buffer.concat([data, chunk]); });
  req.on("end", () => {
    (req as typeof req & { rawBody: Buffer }).rawBody = data;
    // Manually parse JSON after capturing raw body
    try {
      if (data.length > 0) req.body = JSON.parse(data.toString("utf8"));
    } catch {
      req.body = {};
    }
    next();
  });
});

// Webhook verification by Meta
webhookRouter.get("/:companySlug", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info("WhatsApp webhook verified", { slug: req.params.companySlug });
    res.status(200).send(challenge);
  } else {
    logger.warn("WhatsApp webhook verification failed", { slug: req.params.companySlug, ip: req.ip });
    res.sendStatus(403);
  }
});

// Receive messages — validate HMAC first
webhookRouter.post("/:companySlug", verifyMetaSignature, async (req, res) => {
  // Respond immediately (Meta requires < 20s)
  res.sendStatus(200);

  const slug = req.params.companySlug;
  const payload = req.body as WhatsAppWebhookPayload;

  try {
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, whatsappToken: true, isActive: true },
    });

    if (!company || !company.isActive) {
      logger.warn("Webhook for unknown or inactive company", { slug });
      return;
    }

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value.messages?.length) continue;

        for (const message of value.messages) {
          if (message.type !== "text") continue;

          logger.debug("Processing WhatsApp message", {
            companyId: company.id,
            from: message.from,
            messageId: message.id,
          });

          const response = await orchestrate({
            companyId: company.id,
            phoneNumberId: value.metadata.phone_number_id,
            from: message.from,
            message,
          });

          if (response) {
            await sendWhatsAppMessage({
              phoneNumberId: value.metadata.phone_number_id,
              token: company.whatsappToken ?? "",
              to: message.from,
              text: response,
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error("Webhook processing error", { slug, error: (err as Error).message });
  }
});
