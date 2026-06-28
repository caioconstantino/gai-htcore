// Tipos locais do backend (espelhados do @gai/shared para evitar dependência de build)

// ── Evolution API webhook payload ─────────────────────────────────────────────

export interface EvolutionWebhookPayload {
  event:    string;         // "messages.upsert", "messages.update", etc.
  instance: string;         // instance name
  data: {
    key: {
      remoteJid: string;    // "5511999999999@s.whatsapp.net"
      fromMe:    boolean;
      id:        string;    // message id
    };
    message?: {
      conversation?:          string;
      extendedTextMessage?:   { text: string };
      messageType?:           string;
    };
    messageType:   string;  // "conversation", "extendedTextMessage", etc.
    messageTimestamp: number;
    pushName?:     string;  // contact display name
  };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: {
    messaging_product: string;
    metadata: { phone_number_id: string };
    contacts?: Array<{ profile: { name: string }; wa_id: string }>;
    messages?: WhatsAppMessage[];
    statuses?: Array<{ id: string; status: string; timestamp: string }>;
  };
  field: string;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}
