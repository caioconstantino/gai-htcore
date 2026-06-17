import { logger } from "../lib/logger.js";

// waba-v2.360dialog.io → endpoint is /messages (no /v1/ prefix, Cloud API format)
// waba-sandbox.360dialog.io → legacy sandbox
const BASE_URL = (process.env.DIALOG_360_BASE_URL ?? "https://waba-sandbox.360dialog.io").replace(/\/$/, "");

interface SendMessageInput {
  apiKey: string;
  to: string;
  text: string;
}

export async function sendWhatsAppMessage(input: SendMessageInput): Promise<void> {
  const { apiKey, to, text } = input;

  // waba-v2 uses Cloud API format at /messages; legacy uses /v1/messages
  const isV2 = BASE_URL.includes("waba-v2");
  const endpoint = isV2 ? `${BASE_URL}/messages` : `${BASE_URL}/v1/messages`;

  const body = isV2
    ? { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: text } }
    : { to, type: "text", text: { body: text } };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "D360-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error("360dialog send error", { status: response.status, error, to, endpoint });
    throw new Error(`360dialog API error: ${response.status}`);
  }

  logger.info("360dialog message sent", { to, endpoint });
}
