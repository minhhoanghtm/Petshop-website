import express from "express";
import { createMomoPayment, momoIpn } from "../controllers/paymentController.js";
import { protectedRoute } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/momo/create", protectedRoute, createMomoPayment);
router.post("/momo/ipn", momoIpn);

export default router;
