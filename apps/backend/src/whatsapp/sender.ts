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
 * Split a response into one sentence per WhatsApp message.
 *
 * Split points: [.!?] followed by whitespace and an uppercase letter (pt-BR aware).
 * Short sentences (< MIN_LEN chars) are merged with the previous chunk to avoid
 * single-word bubbles. Newlines are also treated as split points.
 */
const MIN_SENTENCE_LEN = 35;
const PT_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÀÂÊÔÃÕÜÇ";

export function splitMessage(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Split at: [.!?] + spaces, where the next non-space char is uppercase (new sentence)
  // OR at newlines. Keep the punctuation with the preceding sentence.
  const raw: string[] = [];
  let cursor = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (ch === "\n") {
      const part = trimmed.slice(cursor, i).trim();
      if (part) raw.push(part);
      cursor = i + 1;
      continue;
    }

    if (ch === "." || ch === "!" || ch === "?") {
      // Consume any trailing punctuation (e.g. "!!")
      let end = i + 1;
      while (end < trimmed.length && ".!?".includes(trimmed[end])) end++;
      // Skip spaces
      let next = end;
      while (next < trimmed.length && trimmed[next] === " ") next++;
      // If the next real character is uppercase → sentence boundary
      if (next >= trimmed.length || PT_UPPER.includes(trimmed[next])) {
        const part = trimmed.slice(cursor, end).trim();
        if (part) raw.push(part);
        cursor = next;
        i = next - 1;
      }
    }
  }

  // Remaining text
  const tail = trimmed.slice(cursor).trim();
  if (tail) raw.push(tail);

  if (raw.length === 0) return [trimmed];

  // Merge very short chunks with the previous one
  const chunks: string[] = [];
  for (const s of raw) {
    const last = chunks[chunks.length - 1];
    if (last && last.length < MIN_SENTENCE_LEN) {
      chunks[chunks.length - 1] = `${last} ${s}`;
    } else {
      chunks.push(s);
    }
  }

  return chunks.filter(Boolean);
}

/** Send a WhatsApp document (PDF, etc.) by public URL. */
export async function sendWhatsAppDocument(input: {
  apiKey:      string;
  to:          string;
  documentUrl: string;
  filename:    string;
  caption?:    string;
}): Promise<void> {
  const { apiKey, to, documentUrl, filename, caption } = input;

  const docPayload = { link: documentUrl, filename, ...(caption ? { caption } : {}) };
  const body = IS_V2
    ? { messaging_product: "whatsapp", recipient_type: "individual", to, type: "document", document: docPayload }
    : { to, type: "document", document: docPayload };

  const response = await post360(apiKey, body);
  if (!response.ok) {
    const error = await response.text();
    logger.error("360dialog document send error", { status: response.status, error, to, documentUrl });
    throw new Error(`360dialog document API error ${response.status}: ${error}`);
  }
  logger.info("360dialog document sent", { to, filename });
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
 * Send a response message split into sentences, with a delay between parts.
 * If a part fails (e.g. Meta rate-limit 131037), the remaining parts are joined
 * and sent as a single fallback message.
 */
export async function sendWhatsAppMessage(input: {
  apiKey: string;
  to: string;
  text: string;
  delayBetweenMs?: number;
}): Promise<void> {
  const { apiKey, to, text, delayBetweenMs = 1200 } = input;

  const chunks = splitMessage(text);
  if (chunks.length === 0) return;

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await delay(delayBetweenMs);
    try {
      await sendSingle(apiKey, to, chunks[i]);
      logger.info("360dialog message sent", { to, part: i + 1, total: chunks.length });
    } catch (err) {
      // If a part fails, consolidate all remaining (including this one) into one message
      const remaining = chunks.slice(i).join(" ");
      logger.warn("Part failed — sending remaining as single message", { to, part: i + 1, total: chunks.length });
      await sendSingle(apiKey, to, remaining);
      logger.info("360dialog fallback message sent", { to });
      break;
    }
  }
}
