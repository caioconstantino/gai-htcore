import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { orchestrate } from "../orchestrator/index.js";
import { sendWhatsAppMessage } from "../whatsapp/sender.js";
import { logger } from "../lib/logger.js";
import type { WhatsAppWebhookPayload } from "../types.js";

export const webhookRouter: ExpressRouter = Router();

// Verificação do webhook pela Meta
webhookRouter.get("/:companySlug", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recebimento de mensagens
webhookRouter.post("/:companySlug", async (req, res) => {
  // Responde imediatamente para a Meta (obrigatório em < 20s)
  res.sendStatus(200);

  const slug = req.params.companySlug;
  const payload = req.body as WhatsAppWebhookPayload;

  try {
    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value.messages?.length) continue;

        for (const message of value.messages) {
          if (message.type !== "text") continue;

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
    logger.error("Webhook processing error", err);
  }
});
