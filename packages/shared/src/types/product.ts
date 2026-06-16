export interface Product {
  id: string;
  companyId: string;
  name: string;
  category: string;
  description?: string;
  dailyPrice: number;
  weeklyPrice?: number;
  monthlyPrice?: number;
  minimumDays: number;
  freightCalculation: FreightCalculationType;
  requiredInfoForQuote: string[];
  commonQuestions: string[];
  isMostSold: boolean;
  isHighRevenue: boolean;
  isActive: boolean;
  imageUrl?: string;
  documents: ProductDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export type FreightCalculationType = "fixed" | "per_km" | "by_equipment" | "free";

export interface ProductDocument {
  id: string;
  name: string;
  url: string;
  type: "manual" | "catalog" | "contract" | "other";
}

export interface CommercialRule {
  id: string;
  companyId: string;
  hasFixedPriceTable: boolean;
  allowsDiscount: boolean;
  maxDiscountPercent: number;
  paymentMethods: PaymentMethod[];
  freightRules: string;
  additionalRules: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentMethod = "pix" | "boleto" | "credit_card" | "invoice";
