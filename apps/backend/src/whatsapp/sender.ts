import { logger } from "../lib/logger.js";

// waba-v2.360dialog.io → /messages (Cloud API format, no /v1/ prefix)
// waba-sandbox.360dialog.io → /v1/messages (legacy format)
const BASE_URL = (process.env.DIALOG_360_BASE_URL ?? "https://waba-sandbox.360dialog.io").replace(/\/$/, "");
const IS_V2 = BASE_URL.includes("waba-v2");
const ENDPOINT = IS_V2 ? `${BASE_URL}/messages` : `${BASE_URL}/v1/messages`;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post360(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: { "D360-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Mark an inbound message as read — shows blue ticks instantly to the user. */
export async function markAsRead(apiKey: string, messageId: string): Promise<void> {
  if (!IS_V2) return; // only supported on v2
  try {
    await post360(apiKey, { messaging_product: "whatsapp", status: "read", message_id: messageId });
  } catch {
    // non-critical — never block main flow
  }
}

/**
 * Split a response into natural WhatsApp-sized chunks.
 * Strategy: split on blank lines first; if a chunk is still long,
 * split at sentence endings near the 280-char mark.
 */
export function splitMessage(text: string, maxLen = 280): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Split on double newlines (paragraphs)
  const paragraphs = trimmed.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= maxLen) {
      chunks.push(para);
      continue;
    }
    // Para too long — split at sentence boundary near maxLen
    let remaining = para;
    while (remaining.length > maxLen) {
      // Find last sentence ending before maxLen
      const slice = remaining.slice(0, maxLen + 1);
      const sentenceEnd = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf(".\n"),
      );
      const cutAt = sentenceEnd > maxLen * 0.4 ? sentenceEnd + 1 : maxLen;
      chunks.push(remaining.slice(0, cutAt).trim());
      remaining = remaining.slice(cutAt).trim();
    }
    if (remaining) chunks.push(remaining);
  }

  return chunks.filter(Boolean);
}

/** Send a WhatsApp text message (single chunk). */
async function sendSingle(apiKey: string, to: string, text: string): Promise<void> {
  const body = IS_V2
    ? { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: text } }
    : { to, type: "text", text: { body: text } };

  const response = await post360(apiKey, body);
  if (!response.ok) {
    const error = await response.text();
    logger.error("360dialog send error", { status: response.status, error, to, endpoint: ENDPOINT });
    throw new Error(`360dialog API error: ${response.status}`);
  }
}

/**
 * Send a response message, automatically splitting into multiple parts
 * with a natural delay between them.
 */
export async function sendWhatsAppMessage(input: {
  apiKey: string;
  to: string;
  text: string;
  delayBetweenMs?: number;
}): Promise<void> {
  const { apiKey, to, text, delayBetweenMs = 600 } = input;

  const chunks = splitMessage(text);
  if (chunks.length === 0) return;

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await delay(delayBetweenMs);
    await sendSingle(apiKey, to, chunks[i]);
    logger.info("360dialog message sent", { to, part: i + 1, total: chunks.length });
  }
}
