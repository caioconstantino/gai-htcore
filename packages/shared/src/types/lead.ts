export interface Lead {
  id: string;
  companyId: string;
  name?: string;
  companyName?: string;
  phone: string;
  source: LeadSource;
  stage: LeadStage;
  temperature: LeadTemperature;
  currentAgentId?: string;
  assignedUserId?: string;
  context: Record<string, unknown>;
  lastInteractionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type LeadSource = "whatsapp" | "site" | "phone" | "referral" | "other";

export type LeadStage =
  | "new"
  | "qualifying"
  | "quoting"
  | "negotiating"
  | "won"
  | "lost"
  | "follow_up";

export type LeadTemperature = "hot" | "warm" | "cold";

export interface Quote {
  id: string;
  leadId: string;
  companyId: string;
  products: QuoteItem[];
  totalValue: number;
  discountPercent: number;
  deliveryLocation: string;
  startDate: Date;
  endDate: Date;
  status: QuoteStatus;
  pdfUrl?: string;
  createdAt: Date;
}

export interface QuoteItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  periodDays: number;
}

export type QuoteStatus = "draft" | "sent" | "approved" | "rejected" | "expired";
