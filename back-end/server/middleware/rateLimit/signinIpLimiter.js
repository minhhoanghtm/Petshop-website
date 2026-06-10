import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import redisClient from '../../configs/redisClient.js';
import { logger } from '../../logger/logger.js';
import { getClientIp } from '../../utils/ipUtils.js';

const limiterOptions = {
  keyPrefix: 'signin_ip',
  points: 100, // 100 requests
  duration: 15 * 60, // 15 minutes
  blockDuration: 15 * 60, // Block 15 minutes if exceeded
};

const signinIpLimiter = redisClient.isMock
  ? new RateLimiterMemory(limiterOptions)
  : new RateLimiterRedis({
      storeClient: redisClient,
      useRedisPackage: true,
      ...limiterOptions,
    });

export const signinIpLimiterMiddleware = async (req, res, next) => {
  const ip = getClientIp(req);
  const key = String(ip);

  try {
    const rateLimiterRes = await signinIpLimiter.get(key);
    if (rateLimiterRes !== null && rateLimiterRes.remainingPoints <= 0) {
      const retrySecs = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
      const retryMins = Math.ceil(retrySecs / 60);
      logger.warn('IP Signin rate limit exceeded', { ip, retryMins });
      return res.status(429).json({
        message: `Bạn đã thực hiện quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau ${retryMins} phút.`,
      });
    }

    await signinIpLimiter.consume(key);
    next();
  } catch (error) {
    if (error && error.remainingPoints === 0) {
      const retrySecs = Math.ceil(error.msBeforeNext / 1000);
      const retryMins = Math.ceil(retrySecs / 60);
      logger.warn('IP Signin rate limit exceeded (consume)', { ip, retryMins });
      return res.status(429).json({
        message: `Bạn đã thực hiện quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau ${retryMins} phút.`,
      });
    }
    // Fail-open: if Redis fails, log and let request pass through
    logger.error('IP Signin Rate Limiter Error:', { message: error.message, stack: error.stack });
    next();
  }
};
