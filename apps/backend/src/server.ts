import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { logger } from "./lib/logger.js";
import { webhookRouter } from "./routes/webhook.js";
import { authRouter } from "./routes/auth.js";
import { companiesRouter } from "./routes/companies.js";
import { agentsRouter } from "./routes/agents.js";
import { productsRouter } from "./routes/products.js";
import { leadsRouter } from "./routes/leads.js";
import { conversationsRouter } from "./routes/conversations.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { usersRouter } from "./routes/users.js";
import { quotesRouter } from "./routes/quotes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/auth.js";
import { tenantGuard } from "./middleware/tenant.js";
import { initQueues } from "./queues/index.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    skip: (req) => req.path.startsWith("/webhook"),
  })
);

// Webhook WhatsApp — sem auth (Meta valida via verify_token)
app.use("/webhook", webhookRouter);

// Auth — sem tenant guard
app.use("/api/v1/auth", authRouter);

// Rotas protegidas — auth + tenant isolation
const api = express.Router();
api.use(authenticate, tenantGuard);

api.use("/companies", companiesRouter);
api.use("/agents", agentsRouter);
api.use("/products", productsRouter);
api.use("/leads", leadsRouter);
api.use("/conversations", conversationsRouter);
api.use("/quotes", quotesRouter);
api.use("/dashboard", dashboardRouter);
api.use("/users", usersRouter);

app.use("/api/v1", api);

app.get("/health", (_req, res) => res.json({ status: "ok", version: "1.0.0" }));

app.use(errorHandler);

async function start() {
  await initQueues();
  app.listen(PORT, () => {
    logger.info(`G.AI Backend running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

start().catch((err) => {
  logger.error("Failed to start server", err);
  process.exit(1);
});
