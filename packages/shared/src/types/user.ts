export interface User {
  id: string;
  companyId?: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  tokensUsed: number;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole =
  | "super_admin"   // HT Core Solutions — acesso a tudo
  | "company_admin" // admin da locadora
  | "manager"
  | "commercial"
  | "operator";
