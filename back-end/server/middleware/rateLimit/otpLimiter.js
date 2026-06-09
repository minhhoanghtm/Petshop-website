import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import redisClient from "../../configs/redisClient.js";
import { logger } from "../../logger/logger.js";

const limiterOptions = {
    keyPrefix: 'otp_send',
    points: 5, //5 lần
    duration: 60 * 10, //10 phút
    blockDuration: 60 * 10, //Khóa 10 phút nếu vượt quá giới hạn
};

export const otpSendLimiter = redisClient.isMock
    ? new RateLimiterMemory(limiterOptions)
    : new RateLimiterRedis({
        ...limiterOptions,
        storeClient: redisClient,
        useRedisPackage: true
      });

export const otpSendLimiterMiddleware = async (req, res, next) => {
    const email = req.body?.email;
    if (!email) {
        return res.status(400).json({ message: "Email là bắt buộc." });
    }

    const key = String(email).trim().toLowerCase();

    try {
        const rateLimiterRes = await otpSendLimiter.get(key);
        if (rateLimiterRes !== null && rateLimiterRes.remainingPoints <= 0) {
            const retrySecs = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
            const retryMins = Math.ceil(retrySecs / 60);
            logger.warn("OTP send rate limit exceeded", { email, retryMins });
            return res.status(429).json({
                message: `Bạn đã yêu cầu gửi mã OTP quá nhiều lần. Vui lòng thử lại sau ${retryMins} phút.`
            });
        }

        await otpSendLimiter.consume(key);
        next();
    } catch (error) {
        if (error && error.remainingPoints === 0) {
            const retrySecs = Math.ceil(error.msBeforeNext / 1000);
            const retryMins = Math.ceil(retrySecs / 60);
            logger.warn("OTP send rate limit exceeded (consume)", { email, retryMins });
            return res.status(429).json({
                message: `Bạn đã yêu cầu gửi mã OTP quá nhiều lần. Vui lòng thử lại sau ${retryMins} phút.`
            });
        }
        // Fail-open: Nếu lỗi kết nối Redis, log lỗi và cho phép tiếp tục
        logger.error("OTP Rate Limiter Error:", { message: error.message, stack: error.stack });
        next();
    }
};
