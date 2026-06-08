import express from "express";
import {
    createOrder,
    getOrders,
    getOrderById,
    updateOrder,
    deleteOrder,
    getOrderStats,
    getRecentOrders,
} from "../controllers/orderController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";
import { orderLimiterMiddleware } from "../middleware/rateLimit/orderLimiter.js";

const router = express.Router();

// tạo đơn hàng mới
router.post("/", orderLimiterMiddleware, createOrder);

// lấy tất cả đơn hàng (admin xem tất cả, user chỉ xem của mình)
router.get("/", getOrders);

// thống kê đơn hàng (admin)
router.get("/stats", requireAdmin, getOrderStats);

// đơn hàng gần đây (admin)
router.get("/recent", requireAdmin, getRecentOrders);

// lấy đơn hàng theo ID (admin hoặc chủ đơn)
router.get("/:id", getOrderById);

// cập nhật đơn hàng:
// - admin: cập nhật mọi trạng thái
// - user: chỉ được huỷ đơn của chính mình
router.put("/:id", updateOrder);

// xoá đơn hàng (admin)
router.delete("/:id", requireAdmin, deleteOrder);

export default router;
