/**
 * Tự động đọc cache hoặc query DB và lưu lại vào cache
 * @param {string} key - Key lưu trên Redis
 * @param {number} ttl - Thời gian sống của cache (giây)
 * @param {function} fetchFunction - Hàm truy vấn DB nếu cache miss
 */

import { cache } from "react";
import redisClient from "../configs/redisClient.js";
import { logger } from "../logger/logger.js";

export const getOrSetCache = async (key, ttl, fetchFunction) => {
  try {
    //Kiểm tra redis
    const cacheData = await redisClient.get(key);
    if (cacheData) {
      logger.debug(`Cache HIT for key: ${key}`);
      return JSON.parse(cacheData);
    }

    //Nếu không có, gọi hàm truy vấn DB
    logger.debug(`Cache MISS for key: ${key}. Fetching from DB.`);
    const freshData = await fetchFunction();

    //Lưu lại vào Redis với TTL
    if (freshData !== null && freshData !== undefined) {
      await redisClient.set(key, JSON.stringify(freshData), {
        EX: ttl,
      });
    }
    return freshData;
  } catch (error) {
    logger.error(`Cache bị lỗi với key: ${key}: `, { message: error.message });
    return await fetchFunction();
  }
};

/**
 * Xóa danh sách cache theo Pattern (Wildcard)
 * Ví dụ: Xóa tất cả key chứa "product:detail:*"
 */
export const invalidCachePattern = async (pattern) => {
    try {
        
    } catch (error) {
        logger.error(`Error invalidation cache pattern ${pattern}: `, {message: error.message});
    }
}