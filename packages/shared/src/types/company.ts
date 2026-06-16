export interface Company {
  id: string;
  name: string;
  slug: string;
  whatsappPhoneNumberId: string;
  whatsappToken: string;
  aiProvider: AIProvider;
  aiModel: string;
  tokenLimit: number;
  tokensUsed: number;
  userLimit: number;
  isActive: boolean;
  plan: CompanyPlan;
  logoUrl?: string;
  primaryColor?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AIProvider = "openai" | "gemini" | "claude" | "vertex";

export type CompanyPlan = "trial" | "basic" | "pro" | "enterprise";
