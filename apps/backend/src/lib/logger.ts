import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const isProd = process.env.NODE_ENV === "production";

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const rid = requestId ? ` [${requestId}]` : "";
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}${rid}: ${message}${extra}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProd ? jsonFormat : consoleFormat,
  }),
];

if (isProd) {
  transports.push(
    new DailyRotateFile({
      filename: "logs/app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
      format: jsonFormat,
    }),
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "30d",
      format: jsonFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: isProd ? "info" : "debug",
  transports,
});
