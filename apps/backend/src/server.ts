import "dotenv/config";
import "express-async-errors"; // monkey-patches Express to catch async errors

import path from "path";
import { fileURLToPath } from "url";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import { logger } from "./lib/logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/auth.js";
import { tenantGuard } from "./middleware/tenant.js";
import { initQueues } from "./queues/index.js";

import { webhookRouter } from "./routes/webhook.js";
import { authRouter } from "./routes/auth.js";
import { companiesRouter } from "./routes/companies.js";
import { agentsRouter } from "./routes/agents.js";
import { agentTemplatesRouter } from "./routes/agent-templates.js";
import { productsRouter } from "./routes/products.js";
import { globalProductsRouter } from "./routes/global-products.js";
import { leadsRouter } from "./routes/leads.js";
import { conversationsRouter } from "./routes/conversations.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { usersRouter } from "./routes/users.js";
import { quotesRouter } from "./routes/quotes.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Trust first proxy (Nginx, Cloudflare, etc.) for correct client IPs in rate limiting
app.set("trust proxy", 1);

// ── Security headers ──────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // managed by Next.js frontend
}));

// ── CORS ─────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman in dev)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id"],
}));

// ── Compression (gzip/br) ─────────────────────────────────────────
app.use(compression());

// ── Request logging with request ID ──────────────────────────────
app.use(requestLogger);

// ── Global rate limit ─────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith("/webhook"),
    keyGenerator: (req) => req.ip ?? "unknown",
    handler: (_req, res) => {
      res.status(429).json({ error: "Muitas requisições. Tente novamente em alguns minutos." });
    },
  })
);

// ── Request timeout (30s) ─────────────────────────────────────────
app.use((req, res, next) => {
  res.setTimeout(30_000, () => {
    logger.warn("Request timeout", { requestId: req.requestId, url: req.originalUrl });
    if (!res.headersSent) res.status(503).json({ error: "Timeout: a requisição demorou muito" });
  });
  next();
});

// ── Static files: generated PDFs (quotes) ────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ── Webhook (raw body for HMAC) — before express.json() ───────────
app.use("/webhook", webhookRouter);

// ── JSON parser for API routes ────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ── Auth routes (no tenant guard) ────────────────────────────────
app.use("/api/v1/auth", authRouter);

// ── Protected routes ─────────────────────────────────────────────
const api = express.Router();
api.use(authenticate, tenantGuard);

api.use("/companies", companiesRouter);
api.use("/agents", agentsRouter);
api.use("/agent-templates", agentTemplatesRouter);
api.use("/products", productsRouter);
api.use("/global-products", globalProductsRouter);
api.use("/leads", leadsRouter);
api.use("/conversations", conversationsRouter);
api.use("/quotes", quotesRouter);
api.use("/dashboard", dashboardRouter);
api.use("/users", usersRouter);

app.use("/api/v1", api);

// ── Health check ──────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// ── Global error handler (must be last) ───────────────────────────
app.use(errorHandler);

// ── Graceful shutdown ─────────────────────────────────────────────
let server: ReturnType<typeof app.listen>;

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason });
  process.exit(1);
});

async function start() {
  if (!process.env.JWT_SECRET) {
    logger.error("JWT_SECRET is not set — refusing to start");
    process.exit(1);
  }

  await initQueues();
  server = app.listen(PORT, () => {
    logger.info(`G.AI Backend started`, { port: PORT, env: process.env.NODE_ENV });
  });
}

start();
