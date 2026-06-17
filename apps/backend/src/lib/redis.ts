import { Redis } from "ioredis";
import { logger } from "./logger.js";

const redisInstance = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
});

redisInstance.on("error", (err: Error) => {
  if ((err as NodeJS.ErrnoException).code === "ECONNREFUSED") {
    logger.warn("Redis não disponível — cache de histórico desabilitado");
  } else {
    logger.error("Redis error", err);
  }
});
redisInstance.on("connect", () => logger.info("Redis connected"));

/** Wrapper noop-safe: se Redis cair, operações retornam null/void sem crashar */
export const redis = {
  get: (key: string) => redisInstance.get(key).catch(() => null),
  setex: (key: string, seconds: number, value: string) =>
    redisInstance.setex(key, seconds, value).catch(() => null),
  del: (key: string) => redisInstance.del(key).catch(() => null),
  /** Expõe a instância bruta para BullMQ (que gerencia erros internamente) */
  raw: redisInstance,
};
