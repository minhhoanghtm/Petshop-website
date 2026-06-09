import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import redisClient from "../../configs/redisClient.js";
import { logger } from "../../logger/logger.js";

const limiterOptions = {
    keyPrefix: 'order_create', // Tiền tố lưu trên Redis
    points: 5,                 // Số lượt tối đa được thực hiện
    duration: 60,              // Thời gian giới hạn (giây)
    blockDuration: 60,         // Khóa 60 giây tiếp theo nếu vượt giới hạn
};

// 1. Cấu hình giới hạn
export const orderLimiter = redisClient.isMock
    ? new RateLimiterMemory(limiterOptions)
    : new RateLimiterRedis({
        ...limiterOptions,
        storeClient: redisClient,
        useRedisPackage: true
      });

export const orderLimiterMiddleware = async (req, res, next) => {
    // 2. Định danh Client: Ưu tiên dùng ID User đã đăng nhập, nếu chưa đăng nhập dùng IP
    const key = req.user?._id ? req.user._id.toString() : req.ip;

    try {
        // 3. Kiểm tra xem Client đã bị khóa chưa
        const rateLimiterRes = await orderLimiter.get(key);
        if (rateLimiterRes !== null && rateLimiterRes.remainingPoints <= 0) {
            const retrySecs = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
            logger.warn("Order creation rate limit exceeded", { key, retrySecs });
            
            return res.status(429).json({
                message: `Bạn đã tạo quá nhiều đơn hàng. Vui lòng thử lại sau ${retrySecs} giây.`
            });
        }

        // 4. Nếu chưa vượt quá giới hạn, tiêu thụ 1 điểm (1 request) và cho đi tiếp
        await orderLimiter.consume(key);
        next();
    } catch (error) {
        // Xử lý lỗi khi tiêu thụ điểm (nếu bị vượt hạn mức đúng thời điểm gọi consume)
        if (error && error.remainingPoints === 0) {
            const retrySecs = Math.ceil(error.msBeforeNext / 1000);
            return res.status(429).json({
                message: `Bạn đã tạo quá nhiều đơn hàng. Vui lòng thử lại sau ${retrySecs} giây.`
            });
        }
        // Fail-open: Nếu Redis bị sập, log lỗi và vẫn cho khách hàng mua hàng bình thường
        logger.error("Order Rate Limiter Error:", { message: error.message, stack: error.stack });
        next();
    }
};