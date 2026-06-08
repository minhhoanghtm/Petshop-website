import dotenv from "dotenv";
dotenv.config();
import { createClient } from "redis";
import { logger } from "../logger/logger.js";

// Tạo một client Redis mới
const redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
        connectTimeout: 5000,
    },
    maxRetriesPerRequest: null,
});

// Xử lý lỗi kết nối Redis
redisClient.on("error", (err) => {
    logger.error("Redis client error", { message: err.message });
});

redisClient.on("connect", () => {
    logger.info("Redis client connecting");
});

redisClient.on("ready", () => {
    logger.info("Redis client ready");
});

redisClient.on("reconnecting", (delay) => {
    logger.warn("Redis client reconnecting", { delay });
});

redisClient.on("end", () => {
    logger.warn("Redis client disconnected");
});

// Kết nối đến Redis
try {
    await redisClient.connect();
    logger.info("Redis client connected");
} catch (error) {
    logger.warn("Redis client initial connection failed, will retry", {
        message: error.message,
    });
}

export default redisClient;