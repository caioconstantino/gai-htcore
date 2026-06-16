import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { sendWhatsAppMessage } from "../whatsapp/sender.js";
import { logger } from "../lib/logger.js";

interface FollowUpJobData {
  companyId: string;
  leadId: string;
  conversationId: string;
  message: string;
  attempt: number;
}

export async function followUpWorker(job: Job<FollowUpJobData>): Promise<void> {
  const { companyId, leadId, message, attempt } = job.data;

  const [company, lead, conversation] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.lead.findUnique({ where: { id: leadId } }),
    prisma.conversation.findFirst({
      where: { companyId, leadId, isActive: true },
    }),
  ]);

  if (!company || !lead || !conversation) return;
  if (conversation.handedOffToHuman) return;

  // Verifica se houve interação recente
  const hoursSinceLastInteraction =
    (Date.now() - lead.lastInteractionAt.getTime()) / 3600000;

  if (hoursSinceLastInteraction < 1) {
    logger.debug(`Lead ${leadId} interacted recently, skipping follow-up`);
    return;
  }

  await sendWhatsAppMessage({
    phoneNumberId: company.whatsappPhoneNumberId ?? "",
    token: company.whatsappToken ?? "",
    to: lead.phone,
    text: message,
  });

  await prisma.message.create({
    data: {
      companyId,
      leadId,
      conversationId: conversation.id,
      direction: "outbound",
      content: message,
      type: "text",
      status: "sent",
    },
  });

  logger.info(`Follow-up sent to lead ${leadId} (attempt ${attempt})`);
}
