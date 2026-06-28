/**
 * Unified WhatsApp dispatcher — routes to 360dialog or Evolution API
 * based on company.whatsappProvider.
 *
 * All callers should use these functions instead of importing from sender.ts directly.
 */

import { sendWhatsAppMessage, sendWhatsAppDocument } from "./sender.js";
import { evolutionSendMessage, evolutionSendDocument } from "./evolution-sender.js";

export type WhatsAppCompany = {
  whatsappProvider?: string | null;
  whatsappToken?:    string | null;
  evolutionApiUrl?:  string | null;
  evolutionApiKey?:  string | null;
  evolutionInstance?: string | null;
};

export async function dispatchMessage(
  company: WhatsAppCompany,
  to: string,
  text: string,
): Promise<void> {
  if (company.whatsappProvider === "evolution") {
    if (!company.evolutionApiUrl || !company.evolutionApiKey || !company.evolutionInstance) {
      throw new Error("Evolution API not fully configured (url/key/instance missing)");
    }
    await evolutionSendMessage({
      baseUrl:  company.evolutionApiUrl,
      apiKey:   company.evolutionApiKey,
      instance: company.evolutionInstance,
      to,
      text,
    });
  } else {
    // Default: 360dialog
    if (!company.whatsappToken) throw new Error("360dialog API key not configured");
    await sendWhatsAppMessage({ apiKey: company.whatsappToken, to, text });
  }
}

export async function dispatchDocument(
  company: WhatsAppCompany,
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string,
): Promise<void> {
  if (company.whatsappProvider === "evolution") {
    if (!company.evolutionApiUrl || !company.evolutionApiKey || !company.evolutionInstance) {
      throw new Error("Evolution API not fully configured (url/key/instance missing)");
    }
    await evolutionSendDocument({
      baseUrl:  company.evolutionApiUrl,
      apiKey:   company.evolutionApiKey,
      instance: company.evolutionInstance,
      to,
      mediaUrl: documentUrl,
      filename,
      caption,
    });
  } else {
    if (!company.whatsappToken) throw new Error("360dialog API key not configured");
    await sendWhatsAppDocument({ apiKey: company.whatsappToken, to, documentUrl, filename, caption });
  }
}
