import redisClient from "../configs/redisClient.js";
import { logger } from "../logger/logger.js";

const ATTEMPTS_PREFIX = "security:login:attempts:";
const LOCK_PREFIX = "security:login:lock:";
const ATTEMPTS_TTL_SECONDS = 24 * 60 * 60;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const getAttemptsKey = (email) => `${ATTEMPTS_PREFIX}${normalizeEmail(email)}`;
const getLockKey = (email) => `${LOCK_PREFIX}${normalizeEmail(email)}`;

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getRemainingLockText = (remainingMs) => {
  if (remainingMs <= 0) return "0 giây";
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) {
    return `${seconds} giây`;
  }
  const minutes = Math.ceil(remainingMs / 60000);
  if (minutes < 60) {
    return `${minutes} phút`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (remMinutes === 0) {
    return `${hours} giờ`;
  }
  return `${hours} giờ ${remMinutes} phút`;
};

const formatLockMessage = (remainingMs) =>
  `Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau ${getRemainingLockText(
    remainingMs,
  )}.`;

export const getLockStatus = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return {
      isLocked: false,
      lockUntil: null,
      remainingMs: 0,
      ttl: null,
      message: null,
    };
  }

  try {
    const lockKey = getLockKey(normalizedEmail);
    const rawLockUntil = await redisClient.get(lockKey);
    const attempts = await getAttemptCount(normalizedEmail);

    logger.debug("Redis getLockStatus raw value", {
      email: normalizedEmail,
      lockKey,
      rawLockUntil,
      attempts,
    });

    if (!rawLockUntil) {
      return {
        isLocked: false,
        lockUntil: null,
        remainingMs: 0,
        ttl: null,
        attempts,
        message: null,
      };
    }

    const lockUntil = parseNumber(rawLockUntil);
    const now = Date.now();
    if (lockUntil <= now) {
      await redisClient.del(lockKey);
      return {
        isLocked: false,
        lockUntil: null,
        remainingMs: 0,
        ttl: null,
        message: null,
      };
    }

    const remainingMs = lockUntil - now;
    const ttl = await redisClient.ttl(lockKey);

    logger.debug("Redis lock status", {
      lockKey,
      lockUntil,
      remainingMs,
      ttl,
    });

    return {
      isLocked: true,
      lockUntil,
      remainingMs,
      ttl,
      attempts,
      message: formatLockMessage(remainingMs),
    };
  } catch (error) {
    logger.warn("Redis lock check failed", {
      email: normalizedEmail,
      message: error.message,
    });

    return {
      isLocked: false,
      lockUntil: null,
      remainingMs: 0,
      ttl: null,
      message: null,
    };
  }
};

export const recordFailedLogin = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return {
      attempts: 0,
      isLocked: false,
      lockUntil: null,
      remainingMs: 0,
      message: null,
    };
  }

  try {
    const lockStatus = await getLockStatus(normalizedEmail);
    if (lockStatus.isLocked) {
      return lockStatus;
    }

    const attemptsKey = getAttemptsKey(normalizedEmail);
    const attempts = await redisClient.incr(attemptsKey);
    await redisClient.expire(attemptsKey, ATTEMPTS_TTL_SECONDS);

    const getRemainingAttemptsToNextTier = (attemptsCount) => {
      if (attemptsCount < 3) return 3 - attemptsCount;
      if (attemptsCount < 5) return 5 - attemptsCount;
      if (attemptsCount < 10) return 10 - attemptsCount;
      return 0;
    };

    logger.debug("Redis recordFailedLogin attempt", {
      email: normalizedEmail,
      attemptsKey,
      attempts,
    });

    let lockDurationMs = 0;
    if (attempts >= 10) {
      lockDurationMs = 24 * 60 * 60 * 1000; // 24 giờ
    } else if (attempts === 5) {
      lockDurationMs = 3 * 60 * 1000; // 3 phút
    } else if (attempts === 3) {
      lockDurationMs = 30 * 1000; // 30 giây
    }

    let lockUntil = null;
    let remainingMs = 0;
    let ttl = null;
    let message = null;

    if (lockDurationMs > 0) {
      const lockKey = getLockKey(normalizedEmail);
      lockUntil = Date.now() + lockDurationMs;
      await redisClient.set(lockKey, String(lockUntil), {
        EX: Math.ceil(lockDurationMs / 1000),
      });

      // Chỉ xóa đếm số lần sai khi bị khóa vĩnh viễn/tối đa (>= 10 lần)
      if (attempts >= 10) {
        await redisClient.del(attemptsKey);
      }

      remainingMs = lockDurationMs;
      ttl = await redisClient.ttl(lockKey);
      message = formatLockMessage(remainingMs);
    }

    logger.debug("Redis failed login result", {
      attemptsKey,
      attempts,
      lockUntil,
      remainingMs,
      ttl,
    });

    return {
      attempts,
      isLocked: Boolean(lockUntil),
      lockUntil,
      remainingMs,
      ttl,
      message,
      remainingAttempts: getRemainingAttemptsToNextTier(attempts),
    };
  } catch (error) {
    logger.warn("Redis failed login write failed", {
      email: normalizedEmail,
      message: error.message,
    });

    return {
      attempts: 0,
      isLocked: false,
      lockUntil: null,
      remainingMs: 0,
      message: null,
    };
  }
};

export const resetLoginState = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    const attemptsKey = getAttemptsKey(normalizedEmail);
    const lockKey = getLockKey(normalizedEmail);

    await redisClient.del([attemptsKey, lockKey]);
    logger.debug("Redis login state reset", {
      attemptsKey,
      lockKey,
    });
  } catch (error) {
    logger.warn("Redis reset login state failed", {
      email: normalizedEmail,
      message: error.message,
    });
  }
};

export const getAttemptCount = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return 0;

  try {
    const raw = await redisClient.get(getAttemptsKey(normalizedEmail));
    return parseNumber(raw);
  } catch (error) {
    logger.warn("Redis get attempt count failed", {
      email: normalizedEmail,
      message: error.message,
    });
    return 0;
  }
};
