import { logger } from "../lib/logger.js";
import { splitMessage } from "./sender.js";

function endpoint(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function post(
  baseUrl: string,
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = endpoint(baseUrl, path);
  const res = await fetch(url, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error("Evolution API error", { status: res.status, url, body: text });
    throw new Error(`Evolution API ${res.status}: ${text.slice(0, 200)}`);
  }
}

function normalizeNumber(phone: string): string {
  // Remove non-digits; Evolution API expects the full number without +
  return phone.replace(/\D/g, "");
}

/**
 * Show "digitando..." (typing indicator) in the WhatsApp chat.
 * Fire-and-forget — never blocks the main flow.
 * Evolution API keeps the indicator active for `durationMs` milliseconds.
 */
export async function evolutionSendTyping(input: {
  baseUrl:     string;
  apiKey:      string;
  instance:    string;
  to:          string;
  durationMs?: number;
}): Promise<void> {
  const { baseUrl, apiKey, instance, to, durationMs = 15000 } = input;
  const url = endpoint(baseUrl, `/chat/sendPresence/${instance}`);
  await fetch(url, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      number:   normalizeNumber(to),
      presence: "composing",
      delay:    durationMs,
    }),
  });
  // No error check — typing indicator is best-effort, never critical
}

/** Send a text message via Evolution API (split into sentences like 360dialog sender). */
export async function evolutionSendMessage(input: {
  baseUrl:      string;
  apiKey:       string;
  instance:     string;
  to:           string;
  text:         string;
  delayBetweenMs?: number;
}): Promise<void> {
  const { baseUrl, apiKey, instance, to, text, delayBetweenMs = 1200 } = input;
  const number = normalizeNumber(to);
  const chunks = splitMessage(text);
  if (chunks.length === 0) return;

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayBetweenMs));
    await post(baseUrl, apiKey, `/message/sendText/${instance}`, {
      number,
      text: chunks[i],
    });
    logger.info("Evolution message sent", { to: number, part: i + 1, total: chunks.length });
  }
}

/** Send a document (PDF, etc.) via Evolution API using a public URL. */
export async function evolutionSendDocument(input: {
  baseUrl:   string;
  apiKey:    string;
  instance:  string;
  to:        string;
  mediaUrl:  string;
  filename:  string;
  caption?:  string;
}): Promise<void> {
  const { baseUrl, apiKey, instance, to, mediaUrl, filename, caption } = input;
  await post(baseUrl, apiKey, `/message/sendMedia/${instance}`, {
    number:    normalizeNumber(to),
    mediatype: "document",
    mimetype:  "application/pdf",
    media:     mediaUrl,
    fileName:  filename,
    caption:   caption ?? "",
  });
  logger.info("Evolution document sent", { to, filename });
}
