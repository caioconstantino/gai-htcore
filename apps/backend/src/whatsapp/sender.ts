import { logger } from "../lib/logger.js";

// Sandbox: https://waba-sandbox.360dialog.io
// Production: https://waba.360dialog.io
const BASE_URL = (process.env.DIALOG_360_BASE_URL ?? "https://waba-sandbox.360dialog.io").replace(/\/$/, "");

interface SendMessageInput {
  apiKey: string;
  to: string;
  text: string;
}

export async function sendWhatsAppMessage(input: SendMessageInput): Promise<void> {
  const { apiKey, to, text } = input;

  const response = await fetch(`${BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "D360-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error("360dialog send error", { status: response.status, error, to });
    throw new Error(`360dialog API error: ${response.status}`);
  }

  logger.debug("360dialog message sent", { to });
}
