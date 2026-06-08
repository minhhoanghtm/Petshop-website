import { RateLimiterRedis } from "rate-limiter-flexible";
import redisClient from "../../configs/redisClient.js";
import { logger } from "../../logger/logger.js";

export const paymentLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'payment_create',
    points: 5, // 5 lần
    duration: 60, // 1 phút
    blockDuration: 60, // Khóa 1 phút nếu vượt quá giới hạn
    useRedisPackage: true
});

export const paymentLimiterMiddleware = async (req, res, next) => {
    // Ưu tiên dùng ID user đã đăng nhập, nếu chưa có thì dùng IP
    const key = req.user?._id ? req.user._id.toString() : req.ip;

    try {
        const rateLimiterRes = await paymentLimiter.get(key);
        if (rateLimiterRes !== null && rateLimiterRes.remainingPoints <= 0) {
            const retrySecs = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
            logger.warn("Payment creation rate limit exceeded", { key, retrySecs });
            return res.status(429).json({
                message: `Bạn đã yêu cầu thanh toán quá nhiều lần. Vui lòng thử lại sau ${retrySecs} giây.`
            });
        }

        await paymentLimiter.consume(key);
        next();
    } catch (error) {
        if (error && error.remainingPoints === 0) {
            const retrySecs = Math.ceil(error.msBeforeNext / 1000);
            logger.warn("Payment creation rate limit exceeded (consume)", { key, retrySecs });
            return res.status(429).json({
                message: `Bạn đã yêu cầu thanh toán quá nhiều lần. Vui lòng thử lại sau ${retrySecs} giây.`
            });
        }
        // Fail-open: log lỗi Redis và cho phép đi tiếp
        logger.error("Payment Rate Limiter Error:", { message: error.message, stack: error.stack });
        next();
    }
};