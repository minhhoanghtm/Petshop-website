import express from "express";
import {
    createOrder,
    getOrders,
    getOrderById,
    updateOrder,
    deleteOrder,
    getOrderStats,
    getRecentOrders,
    reserveCheckoutStock,
    refreshCheckoutStock,
    releaseCheckoutStock,
} from "../controllers/orderController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";
import { orderLimiterMiddleware } from "../middleware/rateLimit/orderLimiter.js";
import { idempotencyMiddleware } from "../middleware/idempotencyMiddleware.js";
import { paginationMiddleware } from "../middleware/paginationMiddleware.js";

const router = express.Router();

// Giữ hàng tạm thời khi khách xem Checkout
router.post("/checkout/reserve", reserveCheckoutStock);
router.post("/checkout/refresh", refreshCheckoutStock);
router.post("/checkout/release", releaseCheckoutStock);

// tạo đơn hàng mới với cơ chế idempotency bảo vệ chống race condition đặt trùng
router.post("/", orderLimiterMiddleware, idempotencyMiddleware, createOrder);

// lấy tất cả đơn hàng có hỗ trợ phân trang tối đa 100 records/page để bảo vệ RAM
router.get("/", paginationMiddleware(10, 1000), getOrders);

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
