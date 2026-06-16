import { Queue, Worker } from "bullmq";
import { followUpWorker } from "./followup.worker.js";
import { logger } from "../lib/logger.js";

const connection = {
  host: new URL(process.env.REDIS_URL ?? "redis://localhost:6379").hostname,
  port: Number(new URL(process.env.REDIS_URL ?? "redis://localhost:6379").port) || 6379,
};

export const followUpQueue = new Queue("follow-up", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export async function initQueues(): Promise<void> {
  const worker = new Worker("follow-up", followUpWorker, {
    connection,
    concurrency: 5,
  });

  worker.on("completed", (job) => logger.debug(`Follow-up job ${job.id} completed`));
  worker.on("failed", (job, err) => logger.error(`Follow-up job ${job?.id} failed`, err));

  logger.info("Queues initialized");
}
