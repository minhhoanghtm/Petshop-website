import express from "express";
import {
  createVoucher,
  updateVoucher,
  softDeleteVoucher,
  toggleVoucherActive,
  getVoucherStats,
  getVoucherHistory,
  getPublicVouchers,
  claimVoucher,
  getUserWallet,
  applyVoucher
} from "../controllers/voucherController.js";
import { protectedRoute, requireAdmin } from "../middleware/authMiddleware.js";
import {
  voucherClaimLimiterMiddleware,
  voucherApplyLimiterMiddleware
} from "../middleware/rateLimit/voucherLimiter.js";

const router = express.Router();

// Public route to view public vouchers (runs protectedRoute only if token is present to attach user profile)
router.get("/public", (req, res, next) => {
  if (req.headers.authorization || (req.headers.cookie && req.headers.cookie.includes("refreshToken"))) {
    return protectedRoute(req, res, next);
  }
  next();
}, getPublicVouchers);

// User-only routes (requires user login)
router.post("/claim", protectedRoute, voucherClaimLimiterMiddleware, claimVoucher);
router.get("/wallet", protectedRoute, getUserWallet);
router.post("/apply", protectedRoute, voucherApplyLimiterMiddleware, applyVoucher);

// Admin-only routes (requires admin role)
router.post("/", protectedRoute, requireAdmin, createVoucher);
router.put("/:id", protectedRoute, requireAdmin, updateVoucher);
router.delete("/:id", protectedRoute, requireAdmin, softDeleteVoucher);
router.patch("/:id/toggle", protectedRoute, requireAdmin, toggleVoucherActive);
router.get("/admin/stats", protectedRoute, requireAdmin, getVoucherStats);
router.get("/admin/:id/history", protectedRoute, requireAdmin, getVoucherHistory);

export default router;
