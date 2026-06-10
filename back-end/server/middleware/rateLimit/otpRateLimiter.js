import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import redisClient from '../../configs/redisClient.js';
import { logger } from '../../logger/logger.js';
import { getClientIp } from '../../utils/ipUtils.js';

// 3 OTP gửi / 15 phút / email
const emailLimiterOptions = {
  keyPrefix: 'otp_email',
  points: 3,
  duration: 15 * 60, // 15 mins
  blockDuration: 15 * 60, // Block 15 mins if exceeded
};

// 20 OTP gửi / giờ / IP
const ipLimiterOptions = {
  keyPrefix: 'otp_ip',
  points: 20,
  duration: 60 * 60, // 1 hour
  blockDuration: 60 * 60, // Block 1 hour if exceeded
};

const otpEmailLimiter = redisClient.isMock
  ? new RateLimiterMemory(emailLimiterOptions)
  : new RateLimiterRedis({
      storeClient: redisClient,
      useRedisPackage: true,
      ...emailLimiterOptions,
    });

const otpIpLimiter = redisClient.isMock
  ? new RateLimiterMemory(ipLimiterOptions)
  : new RateLimiterRedis({
      storeClient: redisClient,
      useRedisPackage: true,
      ...ipLimiterOptions,
    });

export const otpRateLimiterMiddleware = async (req, res, next) => {
  const email = req.body?.email;
  const ip = getClientIp(req);

  if (!email) {
    return res.status(400).json({ message: 'Email là bắt buộc.' });
  }

  const emailKey = String(email).trim().toLowerCase();
  const ipKey = String(ip);

  try {
    // Check email limit first
    const emailRes = await otpEmailLimiter.get(emailKey);
    if (emailRes !== null && emailRes.remainingPoints <= 0) {
      const retrySecs = Math.ceil(emailRes.msBeforeNext / 1000);
      const retryMins = Math.ceil(retrySecs / 60);
      logger.warn('Email OTP rate limit exceeded', { email, retryMins });
      return res.status(429).json({
        message: `Bạn đã yêu cầu gửi mã OTP quá nhiều lần. Vui lòng thử lại sau ${retryMins} phút.`,
      });
    }

    // Check IP limit
    const ipRes = await otpIpLimiter.get(ipKey);
    if (ipRes !== null && ipRes.remainingPoints <= 0) {
      const retrySecs = Math.ceil(ipRes.msBeforeNext / 1000);
      const retryMins = Math.ceil(retrySecs / 60);
      logger.warn('IP OTP rate limit exceeded', { ip, retryMins });
      return res.status(429).json({
        message: `Địa chỉ IP của bạn đã gửi quá nhiều yêu cầu OTP. Vui lòng thử lại sau ${retryMins} phút.`,
      });
    }

    // Consume points
    await otpEmailLimiter.consume(emailKey);
    await otpIpLimiter.consume(ipKey);

    next();
  } catch (error) {
    if (error && error.remainingPoints === 0) {
      const retrySecs = Math.ceil(error.msBeforeNext / 1000);
      const retryMins = Math.ceil(retrySecs / 60);
      logger.warn('OTP rate limit exceeded (consume)', { email, ip, retryMins });
      return res.status(429).json({
        message: `Yêu cầu gửi OTP bị giới hạn. Vui lòng thử lại sau ${retryMins} phút.`,
      });
    }
    // Fail-open: if Redis fails, log and let request pass through
    logger.error('OTP Rate Limiter Error:', { message: error.message, stack: error.stack });
    next();
  }
};
