import SecurityLog from "../models/SecurityLog.js";
import redisClient from "../configs/redisClient.js";
import { otpQueue } from "../queues/otpQueue.js";
import { createMailer, hasMailerConfig } from "../utils/mailer.js";
import { logger } from "../logger/logger.js";
import Voucher from "../models/Voucher.js";
import UserVoucher from "../models/UserVoucher.js";

/**
 * Perform health check for Redis, BullMQ, and SMTP.
 */
export const getSystemHealth = async () => {
  const health = {
    status: "healthy",
    redis: { status: "unhealthy", latencyMs: 0 },
    bullmq: { status: "unhealthy", jobCounts: {} },
    smtp: { status: "unconfigured" },
    timestamp: new Date().toISOString(),
  };

  // 1. Redis Health
  const startRedis = Date.now();
  try {
    const pingRes = await redisClient.ping();
    if (pingRes === "PONG") {
      health.redis.status = "healthy";
      health.redis.latencyMs = Date.now() - startRedis;
    }
  } catch (err) {
    health.status = "unhealthy";
    health.redis.error = err.message;
  }

  // 2. BullMQ Health (depends on Redis connection)
  try {
    if (redisClient.isOpen || redisClient.isMock) {
      const jobCounts = await otpQueue.getJobCounts();
      health.bullmq.status = "healthy";
      health.bullmq.jobCounts = jobCounts;
    }
  } catch (err) {
    health.status = "unhealthy";
    health.bullmq.error = err.message;
  }

  // 3. SMTP Health
  if (hasMailerConfig()) {
    const mailer = createMailer();
    if (mailer) {
      try {
        await mailer.verify();
        health.smtp.status = "healthy";
      } catch (err) {
        health.status = "unhealthy";
        health.smtp.status = "unhealthy";
        health.smtp.error = err.message;
      }
    } else {
      health.smtp.status = "error_initialization";
    }
  }

  return health;
};

/**
 * Retrieve monitoring metrics for Redis, Queue, and Authentication events.
 */
export const getSecurityMetrics = async () => {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Authentication & Security Log Metrics (Past 24h)
  let authMetrics = {
    LOGIN_SUCCESS: 0,
    LOGIN_FAILED: 0,
    ACCOUNT_LOCKED: 0,
    PASSWORD_CHANGED: 0,
    PASSWORD_RESET: 0,
    OTP_SUCCESS: 0,
    OTP_FAILED: 0,
    REFRESH_TOKEN_REPLAY: 0,
    TOKEN_REUSE_DETECTED: 0,
    NEW_DEVICE_LOGIN: 0,
  };

  try {
    const logs = await SecurityLog.aggregate([
      { $match: { createdAt: { $gte: oneDayAgo } } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);

    logs.forEach((log) => {
      if (authMetrics[log._id] !== undefined) {
        authMetrics[log._id] = log.count;
      }
    });
  } catch (err) {
    logger.error("Error gathering auth security metrics", { error: err.message });
  }

  // 2. Redis Metrics
  let redisStats = {};
  if (redisClient.isMock) {
    redisStats = {
      usedMemory: "mock_12MB",
      uptimeSeconds: 3600,
      connectedClients: 1,
      opsPerSec: 0,
    };
  } else {
    try {
      const infoString = await redisClient.info();
      const uptimeMatch = infoString.match(/uptime_in_seconds:(\d+)/);
      const memoryMatch = infoString.match(/used_memory_human:([^\r\n]+)/);
      const clientsMatch = infoString.match(/connected_clients:(\d+)/);
      const opsMatch = infoString.match(/instantaneous_ops_per_sec:(\d+)/);

      redisStats = {
        usedMemory: memoryMatch ? memoryMatch[1] : "N/A",
        uptimeSeconds: uptimeMatch ? parseInt(uptimeMatch[1]) : 0,
        connectedClients: clientsMatch ? parseInt(clientsMatch[1]) : 0,
        opsPerSec: opsMatch ? parseInt(opsMatch[1]) : 0,
      };
    } catch (err) {
      redisStats = { error: err.message };
    }
  }

  // 3. Queue Metrics
  let queueStats = {};
  try {
    queueStats = await otpQueue.getJobCounts();
  } catch (err) {
    queueStats = { error: err.message };
  }

  // 4. Voucher Metrics
  let voucherStats = {};
  try {
    const total = await Voucher.countDocuments({ isDeleted: false });
    const active = await Voucher.countDocuments({ isDeleted: false, status: "ACTIVE", startDate: { $lte: now }, endDate: { $gte: now } });
    const expired = await Voucher.countDocuments({ isDeleted: false, endDate: { $lt: now } });
    const claimed = await UserVoucher.countDocuments({});
    const used = await UserVoucher.countDocuments({ isUsed: true });
    
    // Redemption Rate
    const redemptionRate = claimed > 0 ? (used / claimed) * 100 : 0;

    // Voucher abuse attempts
    const abuseAttempts = await SecurityLog.countDocuments({
      createdAt: { $gte: oneDayAgo },
      event: { $in: ["VOUCHER_CLAIMED", "VOUCHER_APPLIED"] },
      "details.status": "failed"
    });

    // Top Claimed
    const topClaimed = await Voucher.find({ isDeleted: false }).sort({ claimedCount: -1 }).limit(5).select("name code claimedCount");
    // Top Redeemed (Used)
    const topRedeemed = await Voucher.find({ isDeleted: false }).sort({ usedCount: -1 }).limit(5).select("name code usedCount");

    voucherStats = {
      totalVouchers: total,
      activeVouchers: active,
      expiredVouchers: expired,
      claimedVouchers: claimed,
      usedVouchers: used,
      redemptionRate: Math.round(redemptionRate * 100) / 100,
      abuseAttempts,
      topClaimedVouchers: topClaimed,
      topRedeemedVouchers: topRedeemed,
    };
  } catch (err) {
    logger.error("Error gathering voucher metrics", { error: err.message });
    voucherStats = { error: err.message };
  }

  return {
    timeframe: "past_24_hours",
    securityEvents: authMetrics,
    redis: redisStats,
    queue: queueStats,
    vouchers: voucherStats,
    timestamp: new Date().toISOString(),
  };
};
