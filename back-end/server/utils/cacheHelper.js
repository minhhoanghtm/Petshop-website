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
 * Xóa danh sách cache theo Pattern (Wildcard) sử dụng SCAN để tránh block Redis
 * Ví dụ: Xóa tất cả key chứa "products:list:*"
 */
export const invalidateCachePattern = async (pattern) => {
    try {
        const keys = [];
        for await (const key of redisClient.scanIterator({
            MATCH: pattern,
            COUNT: 100
        })) {
            if (Array.isArray(key)) {
                keys.push(...key);
            } else {
                keys.push(key);
            }
        }
        if (keys.length > 0) {
            await redisClient.del(keys);
            logger.info(`Invalidated cache keys matching pattern: ${pattern}`, { count: keys.length });
        }
    } catch (error) {
        logger.error(`Error invalidating cache pattern ${pattern}: `, { message: error.message });
    }
}

/**
 * Xóa cache liên quan đến sản phẩm (detail, list, best seller, và stock pre-gate)
 */
export const clearProductCache = async (slug = null, productId = null) => {
  try {
    // 1. Xóa cache danh sách sản phẩm và sản phẩm bán chạy
    await invalidateCachePattern("products:list:*");
    await redisClient.del("products:best_seller");
    
    // 2. Xóa cache chi tiết sản phẩm cụ thể nếu có truyền slug
    if (slug) {
      await redisClient.del(`products:detail:${slug}`);
    }

    // 3. Xóa cache stock trong Redis pre-gate nếu có truyền productId
    if (productId) {
      await redisClient.del(`stock:product:${productId}`);
    }
  } catch (error) {
    logger.error("Failed to clear product cache:", { message: error.message });
  }
};