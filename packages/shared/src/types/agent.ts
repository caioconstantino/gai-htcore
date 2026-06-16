export interface Agent {
  id: string;
  companyId: string;
  name: string;
  description: string;
  type: AgentType;
  scope: AgentScope;
  prompt: string;
  promptVersion: number;
  isActive: boolean;
  triggerKeywords: string[];
  requiredFields: string[];
  followUpRules: FollowUpRule[];
  createdAt: Date;
  updatedAt: Date;
}

export type AgentType =
  | "commercial"   // agente de produto/equipamento
  | "attendance"   // atendimento geral
  | "support"
  | "qualification"
  | "financial"
  | "registration" // cadastro
  | "followup"
  | "manager"
  | "other";

export type AgentScope = "external" | "internal";

export interface FollowUpRule {
  afterHours: number;
  message: string;
  maxAttempts: number;
}

export interface AgentHandoff {
  fromAgentId: string;
  toAgentId: string;
  reason: string;
  context: Record<string, unknown>;
}
