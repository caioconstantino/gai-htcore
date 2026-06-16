import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { type AuthRequest } from "../middleware/auth.js";

export const dashboardRouter: ExpressRouter = Router();

dashboardRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user?.role === "super_admin" ? undefined : req.user?.companyId;
    const isSuperAdmin = req.user?.role === "super_admin";
    const where = companyId ? { companyId } : {};

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalLeads, hotLeads, totalConversations, wonDeals, pendingQuotes, tokenUsage, leadsBySource, leadsByStage] =
      await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.count({ where: { ...where, temperature: "hot" } }),
        prisma.conversation.count({ where }),
        prisma.lead.count({ where: { ...where, stage: "won" } }),
        prisma.quote.count({ where: { ...where, status: "sent" } }),
        prisma.company.findFirst({
          where: companyId ? { id: companyId } : {},
          select: { tokensUsed: true, tokenLimit: true },
        }),
        prisma.lead.groupBy({ by: ["source"], where: { ...where, createdAt: { gte: thirtyDaysAgo } }, _count: true }),
        prisma.lead.groupBy({ by: ["stage"], where, _count: true }),
      ]);

    const result: Record<string, unknown> = {
      totalLeads, hotLeads, totalConversations, wonDeals, pendingQuotes,
      tokenUsage, leadsBySource, leadsByStage,
    };

    if (isSuperAdmin) {
      const [totalCompanies, activeCompanies, totalUsers, handedOffConversations, recentCompanies] = await Promise.all([
        prisma.company.count(),
        prisma.company.count({ where: { isActive: true } }),
        prisma.user.count({ where: { role: { not: "super_admin" } } }),
        prisma.conversation.count({ where: { handedOffToHuman: true, isActive: true } }),
        prisma.company.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, name: true, slug: true, plan: true, tokensUsed: true, tokenLimit: true, isActive: true, createdAt: true },
        }),
      ]);
      Object.assign(result, { totalCompanies, activeCompanies, totalUsers, handedOffConversations, recentCompanies });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});
