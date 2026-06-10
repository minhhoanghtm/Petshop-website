import * as securityMonitoringService from "../services/securityMonitoringService.js";
import { logger } from "../logger/logger.js";

/**
 * Endpoint for system health checks.
 */
export const checkHealth = async (req, res) => {
  try {
    const health = await securityMonitoringService.getSystemHealth();
    const statusCode = health.status === "healthy" ? 200 : 503;
    return res.status(statusCode).json(health);
  } catch (error) {
    logger.error("Error executing health check endpoint", { error: error.message });
    return res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Endpoint for system security metrics dashboard.
 */
export const getMetrics = async (req, res) => {
  try {
    const metrics = await securityMonitoringService.getSecurityMetrics();
    return res.status(200).json(metrics);
  } catch (error) {
    logger.error("Error executing security metrics endpoint", { error: error.message });
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
