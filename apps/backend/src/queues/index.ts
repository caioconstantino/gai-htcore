import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { followUpWorker } from "./followup.worker.js";
import { logger } from "../lib/logger.js";

export let followUpQueue: Queue | null = null;

export async function initQueues(): Promise<void> {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  let conn: Redis | null = null;
  try {
    conn = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 5000,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 500, 2000)),
    });
    conn.on("error", (err) => logger.warn("BullMQ Redis error: " + err.message));

    await conn.connect();

    const queue = new Queue("follow-up", {
      connection: conn,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });

    await queue.waitUntilReady();
    followUpQueue = queue;

    const worker = new Worker("follow-up", followUpWorker, { connection: conn, concurrency: 5 });
    worker.on("completed", (job) => logger.debug(`Follow-up job ${job.id} completed`));
    worker.on("failed", (job, err) => logger.error(`Follow-up job ${job?.id} failed`, err));
    worker.on("error", (err) => logger.error("BullMQ worker error", err));

    logger.info("Queues (BullMQ) initialized");
  } catch (err) {
    if (conn) {
      conn.removeAllListeners();
      conn.disconnect(false);
    }
    logger.warn("Redis indisponível — filas de follow-up desabilitadas.");
  }
}
