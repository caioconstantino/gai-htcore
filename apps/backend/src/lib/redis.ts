import { Redis } from "ioredis";
import { logger } from "./logger.js";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on("error", (err: Error) => logger.error("Redis error", err));
redis.on("connect", () => logger.info("Redis connected"));
