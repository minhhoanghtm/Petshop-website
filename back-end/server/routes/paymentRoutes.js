import express from "express";
import { createMomoPayment, momoIpn } from "../controllers/paymentController/momoController.js";
import { protectedRoute } from "../middleware/authMiddleware.js";
import { createVNPayPayment, ipnPayment, returnPayment } from "../controllers/paymentController/vnPayController.js";

const router = express.Router();

// Momo payment routes
router.post("/momo/create", protectedRoute, createMomoPayment);
router.post("/momo/ipn", momoIpn);

// VNPay payment routes
router.post("/vnpay/create", protectedRoute, createVNPayPayment);
router.get("/vnpay/return", returnPayment);
router.post("/vnpay/ipn", ipnPayment);

export default router;
