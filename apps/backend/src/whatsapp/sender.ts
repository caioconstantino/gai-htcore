import { logger } from "../lib/logger.js";

interface SendMessageInput {
  phoneNumberId: string;
  token: string;
  to: string;
  text: string;
}

export async function sendWhatsAppMessage(input: SendMessageInput): Promise<void> {
  const { phoneNumberId, token, to, text } = input;

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error(`WhatsApp send error: ${error}`);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }
}
