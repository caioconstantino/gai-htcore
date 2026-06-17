import { prisma } from "../lib/prisma.js";

export type OrchStep =
  | "client_message"
  | "router"
  | "specialist"
  | "orchestrator"
  | "synthesizer"
  | "send"
  | "error"
  | "info";

export async function orchLog(input: {
  companyId: string;
  conversationId: string;
  leadPhone: string;
  step: OrchStep;
  actor: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.orchestrationLog.create({
      data: {
        companyId: input.companyId,
        conversationId: input.conversationId,
        leadPhone: input.leadPhone,
        step: input.step,
        actor: input.actor,
        message: input.message,
        metadata: input.metadata ?? {},
      },
    });
  } catch {
    // never block the main flow
  }
}
