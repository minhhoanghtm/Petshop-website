import dotenv from "dotenv";
dotenv.config();
import Redis from "ioredis";
import { logger } from "../logger/logger.js";
import { EventEmitter } from "events";

const useMock = process.env.NODE_ENV === "test" && !process.env.USE_REAL_REDIS;

let queueRedis;

if (useMock) {
  logger.info("Initializing in-memory mock Queue Redis client for testing...");
  class MockQueueRedis extends EventEmitter {
    constructor() {
      super();
      this.status = "ready";
      this.options = {};
    }
  }

  const handler = {
    get(target, prop) {
      if (prop === "then") return undefined; // Avoid promise-like behavior
      if (prop in target || typeof target[prop] === "function") {
        return target[prop];
      }
      if (prop === "info") {
        return async () => "redis_version:7.0.0";
      }
      if (prop === "multi") {
        return () => {
          const chain = {
            exec: async () => []
          };
          // Allow chaining other methods on multi
          const multiHandler = {
            get(mTarget, mProp) {
              if (mProp in mTarget) return mTarget[mProp];
              return () => chain;
            }
          };
          return new Proxy(chain, multiHandler);
        };
      }
      // Return a generic async function for any other call
      return async (...args) => {
        return null;
      };
    }
  };

  queueRedis = new Proxy(new MockQueueRedis(), handler);
} else {
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  queueRedis = new Redis(redisUrl, {
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
}

export default queueRedis;