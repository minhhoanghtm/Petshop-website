import { logger } from "../logger/logger.js";

/**
 * Extract the client IP address in a proxy-safe manner,
 * supporting Cloudflare headers, Nginx real-IP headers,
 * X-Forwarded-For chains, and Express defaults.
 * 
 * @param {Object} req Express request object
 * @returns {string} Client IP address
 */
export const getClientIp = (req) => {
  if (!req) return "";

  let ip = "";

  // 1. Cloudflare specific header
  if (req.headers && req.headers["cf-connecting-ip"]) {
    ip = req.headers["cf-connecting-ip"];
  }
  // 2. Nginx specific X-Real-IP
  else if (req.headers && req.headers["x-real-ip"]) {
    ip = req.headers["x-real-ip"];
  }
  // 3. X-Forwarded-For header (leftmost is original client)
  else if (req.headers && req.headers["x-forwarded-for"]) {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string") {
      const parts = xff.split(",");
      if (parts.length > 0) {
        ip = parts[0].trim();
      }
    } else if (Array.isArray(xff) && xff.length > 0) {
      ip = xff[0].trim();
    }
  }
  // 4. Express default ip property (relies on trust proxy setting)
  else if (req.ip) {
    ip = req.ip;
  }
  // 5. Socket remote address fallback
  else if (req.socket && req.socket.remoteAddress) {
    ip = req.socket.remoteAddress;
  }

  // Normalize IPv6 mapped IPv4 addresses (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
  if (ip && ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  return ip;
};
