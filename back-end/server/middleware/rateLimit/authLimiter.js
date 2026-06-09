// 5 lần/5 phút
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import redisClient from '../../configs/redisClient.js';

const limiterOptions = {
    keyPrefix: 'login_fail',
    points: 5, //5 lần
    duration: 60 * 10, //10 phút
    blockDuration: 0, //Không chặn lâu dài, chỉ trả về lỗi khi vượt quá giới hạn
};

export const loginLimiter = redisClient.isMock
    ? new RateLimiterMemory(limiterOptions)
    : new RateLimiterRedis({
        ...limiterOptions,
        storeClient: redisClient,
        useRedisPackage: true
      });
