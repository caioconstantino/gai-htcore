import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { dispatchMessage, type WhatsAppCompany } from "../whatsapp/dispatcher.js";
import { type AuthRequest } from "../middleware/auth.js";

export const conversationsRouter: ExpressRouter = Router();

conversationsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.role === "super_admin" ? undefined : req.user?.companyId;
    const page = Math.max(1, parseInt(String(req.query.page ?? 1)));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 50))));

    const where = {
      ...(companyId ? { companyId } : {}),
      ...(req.query.isActive !== undefined ? { isActive: req.query.isActive === "true" } : {}),
      ...(req.query.handedOff === "true" ? { handedOffToHuman: true } : {}),
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          lead: { select: { id: true, name: true, phone: true } },
          currentAgent: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
          messages: { select: { tokensUsed: true } },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    // Compute totalTokensUsed from messages (accurate even for historical convs where the field is 0)
    const enriched = conversations.map(({ messages, ...conv }) => ({
      ...conv,
      totalTokensUsed: messages.reduce((sum, m) => sum + (m.tokensUsed ?? 0), 0),
    }));

    res.json({ data: enriched, total, page, limit });
  } catch (err) { next(err); }
});

conversationsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        currentAgent: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "asc" }, take: 200 },
        _count: { select: { messages: true } },
      },
    });
    if (!conversation) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    if (req.user?.role !== "super_admin" && conversation.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    res.json(conversation);
  } catch (err) { next(err); }
});

conversationsRouter.get("/:id/messages", async (req: AuthRequest, res, next) => {
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!conversation) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    if (req.user?.role !== "super_admin" && conversation.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    res.json(messages);
  } catch (err) { next(err); }
});

conversationsRouter.post("/:id/send", async (req: AuthRequest, res, next) => {
  try {
    const { message } = req.body as { message: string };
    if (!message?.trim()) { res.status(400).json({ error: "Mensagem obrigatória" }); return; }

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { lead: true, company: true },
    });
    if (!conversation) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    if (req.user?.role !== "super_admin" && conversation.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    // Fetch sender name to prefix message (so client sees *Nome:* Mensagem in WhatsApp)
    let senderName: string | null = null;
    if (req.user?.userId) {
      const sender = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { name: true },
      });
      senderName = sender?.name ?? null;
    }

    const rawText    = message.trim();
    const whatsappText = senderName ? `*${senderName}:* ${rawText}` : rawText;

    // Salva a mensagem no banco (formato completo para consistência com o que o cliente vê)
    const saved = await prisma.message.create({
      data: {
        companyId: conversation.companyId,
        leadId: conversation.leadId,
        conversationId: conversation.id,
        direction: "outbound",
        content: whatsappText,
        type: "text",
        sentByUserId: req.user?.userId,
        status: "pending",
      },
    });

    // Send via whichever provider is configured
    try {
      await dispatchMessage(conversation.company as WhatsAppCompany, conversation.lead.phone, whatsappText);
      await prisma.message.update({ where: { id: saved.id }, data: { status: "delivered" } });
    } catch (sendErr) {
      // Log but don't fail — message is saved in DB regardless
      console.error("Manual send WhatsApp error", sendErr);
    }

    res.json(saved);
  } catch (err) { next(err); }
});

conversationsRouter.get("/:id/orch-logs", async (req: AuthRequest, res, next) => {
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!conversation) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    if (req.user?.role !== "super_admin" && conversation.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const logs = await prisma.orchestrationLog.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json(logs);
  } catch (err) { next(err); }
});

conversationsRouter.post("/:id/pause", async (req: AuthRequest, res, next) => {
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!conversation) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    if (req.user?.role !== "super_admin" && conversation.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    await prisma.$executeRaw`UPDATE conversations SET "aiPaused" = true WHERE id = ${req.params.id}`;
    // Track when AI was paused so the orchestrator can load catch-up context on resume
    const conv = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    const ctx = ((conv?.context ?? {}) as Record<string, unknown>);
    await prisma.conversation.update({ where: { id: req.params.id }, data: { context: { ...ctx, aiPausedAt: new Date().toISOString() } } });
    const updated = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) { next(err); }
});

conversationsRouter.post("/:id/resume", async (req: AuthRequest, res, next) => {
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!conversation) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    if (req.user?.role !== "super_admin" && conversation.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    await prisma.$executeRaw`UPDATE conversations SET "aiPaused" = false WHERE id = ${req.params.id}`;
    // Mark resume so orchestrator loads catch-up context on next message
    const conv = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    const ctx = ((conv?.context ?? {}) as Record<string, unknown>);
    const pausedAt = ctx.aiPausedAt as string | undefined;
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { context: { ...ctx, aiResumedAt: new Date().toISOString(), ...(pausedAt ? { aiPausedAt: pausedAt } : {}) } },
    });
    const updated = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) { next(err); }
});

conversationsRouter.post("/:id/handoff", async (req: AuthRequest, res, next) => {
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { companyId: true } });
    if (!conversation) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
    if (req.user?.role !== "super_admin" && conversation.companyId !== req.user?.companyId) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { handedOffToHuman: true },
    });
    res.json(updated);
  } catch (err) { next(err); }
});
