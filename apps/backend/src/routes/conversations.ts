import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";

export const conversationsRouter: ExpressRouter = Router();

conversationsRouter.get("/", async (req: AuthRequest, res) => {
  const companyId = req.user?.companyId;
  const conversations = await prisma.conversation.findMany({
    where: { ...(companyId ? { companyId } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      lead: true,
      currentAgent: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
  });
  res.json(conversations);
});

conversationsRouter.get("/:id/messages", async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: "asc" },
  });
  res.json(messages);
});

// Transbordo manual
conversationsRouter.post("/:id/handoff", async (req, res) => {
  const conversation = await prisma.conversation.update({
    where: { id: req.params.id },
    data: { handedOffToHuman: true },
  });
  res.json(conversation);
});
