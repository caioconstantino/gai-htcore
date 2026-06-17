import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { orchestrate } from "../orchestrator/index.js";
import { sendWhatsAppMessage, markAsRead } from "../whatsapp/sender.js";
import { logger } from "../lib/logger.js";
import type { WhatsAppWebhookPayload } from "../types.js";

export const webhookRouter: ExpressRouter = Router();

// Capture raw body for HMAC validation — must run before express.json()
webhookRouter.use((req, _res, next) => {
  let data = Buffer.alloc(0);
  req.on("data", (chunk: Buffer) => { data = Buffer.concat([data, chunk]); });
  req.on("end", () => {
    (req as typeof req & { rawBody: Buffer }).rawBody = data;
    try {
      if (data.length > 0) req.body = JSON.parse(data.toString("utf8"));
    } catch {
      req.body = {};
    }
    next();
  });
});

// 360dialog does NOT use a GET verification challenge — omit that endpoint.
// If needed for testing: GET /:companySlug returns 200 OK.
webhookRouter.get("/:companySlug", (_req, res) => {
  res.sendStatus(200);
});

// Receive messages from 360dialog
webhookRouter.post("/:companySlug", async (req, res) => {
  const slug = req.params.companySlug;
  const payload = req.body as WhatsAppWebhookPayload;

  try {
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, whatsappToken: true, isActive: true },
    });

    if (!company || !company.isActive) {
      logger.warn("Webhook for unknown or inactive company", { slug });
      res.sendStatus(200);
      return;
    }

    if (!company.whatsappToken) {
      logger.warn("Company has no 360dialog API key configured", { slug });
      res.sendStatus(200);
      return;
    }

    // Acknowledge immediately — 360dialog expects < 10s
    res.sendStatus(200);

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value.messages?.length) continue;

        for (const message of value.messages) {
          if (message.type !== "text") continue;

          const contactName = value.contacts?.[0]?.profile?.name;

          logger.info("Processing 360dialog message", {
            companyId: company.id,
            from: message.from,
            name: contactName,
            messageId: message.id,
          });

          // Mark as read immediately — shows blue ticks to the user right away
          markAsRead(company.whatsappToken, message.id);

          const response = await orchestrate({
            companyId: company.id,
            phoneNumberId: value.metadata.phone_number_id,
            from: message.from,
            message,
          });

          if (response) {
            await sendWhatsAppMessage({
              apiKey: company.whatsappToken,
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
