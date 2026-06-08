import dotenv from "dotenv";
dotenv.config();
import Redis from "ioredis";
import { logger } from "../logger/logger.js";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const queueRedis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

queueRedis.on("connect", () => {
  logger.info("Queue Redis connecting", { redisUrl });
});

queueRedis.on("ready", () => {
  logger.info("Queue Redis ready");
});

queueRedis.on("error", (error) => {
  logger.error("Queue Redis error", { message: error.message });
});

queueRedis.on("reconnecting", (delay) => {
  logger.warn("Queue Redis reconnecting", { delay });
});

queueRedis.on("end", () => {
  logger.warn("Queue Redis disconnected");
});

try {
  await queueRedis.connect();
} catch (error) {
  logger.warn("Queue Redis connection will retry on demand", {
    message: error.message,
  });
}

export default queueRedis;