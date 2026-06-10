import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import redisClient from "../../configs/redisClient.js";
import { logger } from "../../logger/logger.js";

// Limiter for claiming vouchers: 5 requests per 10 seconds per user
const claimLimiterOptions = {
  keyPrefix: "voucher_claim",
  points: 5,
  duration: 10,
  blockDuration: 10,
};

// Limiter for applying vouchers: 10 requests per 10 seconds per user
const applyLimiterOptions = {
  keyPrefix: "voucher_apply",
  points: 10,
  duration: 10,
  blockDuration: 10,
};

export const voucherClaimLimiter = redisClient.isMock
  ? new RateLimiterMemory(claimLimiterOptions)
  : new RateLimiterRedis({
      ...claimLimiterOptions,
      storeClient: redisClient,
      useRedisPackage: true,
    });

export const voucherApplyLimiter = redisClient.isMock
  ? new RateLimiterMemory(applyLimiterOptions)
  : new RateLimiterRedis({
      ...applyLimiterOptions,
      storeClient: redisClient,
      useRedisPackage: true,
    });

export const voucherClaimLimiterMiddleware = async (req, res, next) => {
  const key = req.user?._id ? req.user._id.toString() : req.ip;

  try {
    const rateLimiterRes = await voucherClaimLimiter.get(key);
    if (rateLimiterRes !== null && rateLimiterRes.remainingPoints <= 0) {
      const retrySecs = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
      logger.warn("Voucher claim rate limit exceeded", { key, retrySecs });
      
      return res.status(429).json({
        message: `Bạn đang nhận voucher quá nhanh. Vui lòng thử lại sau ${retrySecs} giây.`,
      });
    }

    await voucherClaimLimiter.consume(key);
    next();
  } catch (error) {
    if (error && error.remainingPoints === 0) {
      const retrySecs = Math.ceil(error.msBeforeNext / 1000);
      return res.status(429).json({
        message: `Bạn đang nhận voucher quá nhanh. Vui lòng thử lại sau ${retrySecs} giây.`,
      });
    }
    logger.error("Voucher Claim Rate Limiter Error:", { message: error.message, stack: error.stack });
    next();
  }
};

export const voucherApplyLimiterMiddleware = async (req, res, next) => {
  const key = req.user?._id ? req.user._id.toString() : req.ip;

  try {
    const rateLimiterRes = await voucherApplyLimiter.get(key);
    if (rateLimiterRes !== null && rateLimiterRes.remainingPoints <= 0) {
      const retrySecs = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
      logger.warn("Voucher apply rate limit exceeded", { key, retrySecs });
      
      return res.status(429).json({
        message: `Bạn đang áp dụng voucher quá nhanh. Vui lòng thử lại sau ${retrySecs} giây.`,
      });
    }

    await voucherApplyLimiter.consume(key);
    next();
  } catch (error) {
    if (error && error.remainingPoints === 0) {
      const retrySecs = Math.ceil(error.msBeforeNext / 1000);
      return res.status(429).json({
        message: `Bạn đang áp dụng voucher quá nhanh. Vui lòng thử lại sau ${retrySecs} giây.`,
      });
    }
    logger.error("Voucher Apply Rate Limiter Error:", { message: error.message, stack: error.stack });
    next();
  }
};
