export interface Message {
  id: string;
  companyId: string;
  leadId: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  content: string;
  type: MessageType;
  agentId?: string;
  sentByUserId?: string;
  whatsappMessageId?: string;
  status: MessageStatus;
  tokensUsed?: number;
  createdAt: Date;
}

export type MessageType = "text" | "image" | "document" | "audio" | "template";

export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface Conversation {
  id: string;
  companyId: string;
  leadId: string;
  currentAgentId?: string;
  stage: string;
  context: Record<string, unknown>;
  isActive: boolean;
  handedOffToHuman: boolean;
  totalTokensUsed: number;
  createdAt: Date;
  updatedAt: Date;
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
