import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import winston from "winston";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, "../../logs");

fs.mkdirSync(logDir, { recursive: true });

const consoleFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const metaText = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}] ${message}${metaText}`;
});

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaText = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    const stackText = stack ? `\n${stack}` : "";
    return `${timestamp} [${level}] ${message}${metaText}${stackText}`;
  }),
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  defaultMeta: { service: "back-end" },
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true })),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      format: fileFormat,
    }),
  ],
});

logger.add(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      consoleFormat,
    ),
  }),
);