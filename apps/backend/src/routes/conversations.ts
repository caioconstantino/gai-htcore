import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
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
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    res.json({ data: conversations, total, page, limit });
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
