import { Queue, Worker } from "bullmq";
import { followUpWorker } from "./followup.worker.js";
import { logger } from "../lib/logger.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = {
  host: new URL(redisUrl).hostname,
  port: Number(new URL(redisUrl).port) || 6379,
  maxRetriesPerRequest: null as null,
  enableOfflineQueue: false,
  lazyConnect: true,
};

export let followUpQueue: Queue | null = null;

export async function initQueues(): Promise<void> {
  try {
    const queue = new Queue("follow-up", {
      connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });

    // Testa conexão antes de registrar o worker
    await queue.waitUntilReady();
    followUpQueue = queue;

    const worker = new Worker("follow-up", followUpWorker, { connection, concurrency: 5 });
    worker.on("completed", (job) => logger.debug(`Follow-up job ${job.id} completed`));
    worker.on("failed", (job, err) => logger.error(`Follow-up job ${job?.id} failed`, err));
    worker.on("error", (err) => logger.error("BullMQ worker error", err));

    logger.info("Queues (BullMQ) initialized");
  } catch (err) {
    logger.warn("Redis indisponível — filas de follow-up desabilitadas. Inicie Redis para ativar.");
  }
}
