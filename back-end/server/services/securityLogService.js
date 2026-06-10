import SecurityLog from "../models/SecurityLog.js";
import { logger } from "../logger/logger.js";

/**
 * Log a security event to MongoDB.
 * Fail-safe: handles any DB write error without throwing it to the client.
 */
export const logSecurityEvent = async ({ event, email, userId, ip, userAgent, details }) => {
  try {
    const logEntry = new SecurityLog({
      event,
      email: email ? String(email).trim().toLowerCase() : undefined,
      userId: userId || null,
      ip: ip || undefined,
      userAgent: userAgent || undefined,
      details: details || {},
    });

    await logEntry.save();
    logger.debug("Security event logged successfully", { event, email });
  } catch (error) {
    logger.error("Failed to write security audit log", {
      event,
      email,
      message: error.message,
      stack: error.stack,
    });
  }
};
