import {
  handleIPN,
  handleReturn,
  initiateVNPayPayment,
} from "../../services/payment/vnpayService.js";

/**
 * POST /api/payments/vnpay/create
 * Frontend gọi API này để lấy URL thanh toán, sau đó redirect khách sang đó.
 * Body: { orderId, amount, orderInfo, bankCode }
 */
export const createVNPayPayment = async (req, res) => {
  try {
    const { orderId, amount, orderInfo, bankCode } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "orderId là bắt buộc" });
    }
    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress;
    // Gọi service để tạo link thanh toán
    const paymentUrl = await initiateVNPayPayment({
      orderId,
      amount,
      orderInfo,
      ipAddr,
      bankCode,
    });
    return res.status(200).json({ paymentUrl, orderId });
  } catch (error) {
    console.error("Lỗi khi tạo link thanh toán VNPay:", error);
    return res.status(error.statusCode || 500).json({ error: error.message || "Có lỗi xảy ra" });
  }
};

/**
 * GET /api/payments/vnpay/return
 * VNPAY redirect khách về đây sau khi thanh toán.
 * Sau khi xử lý, redirect tiếp khách về trang kết quả trên Frontend.
 */
export const returnPayment = async (req, res) => {
  try {
    const result = await handleReturn(req.query);
    // Redirect khách về trang kết quả trên frontend, kèm theo query params để hiển thị thông báo
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_BASE_URL || "http://localhost:5173";

    if (result.success) {
      const redirectUrl = `${frontendUrl}/payment-result?success=true&message=${encodeURIComponent(result.message)}`;
      res.redirect(redirectUrl);
    } else {
      const redirectUrl = `${frontendUrl}/payment-result?success=false&message=${encodeURIComponent(result.message)}`;
      res.redirect(redirectUrl);
    }
  } catch (error) {
    console.error("Lỗi khi xử lý phản hồi thanh toán VNPay:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/payments/vnpay/ipn
 * VNPAY server gọi vào đây để xác nhận giao dịch (server-to-server).
 * Không liên quan đến khách hàng — phải response trong 5 giây.
 */
export const ipnPayment = async (req, res) => {
  try {
    const result = await handleIPN(req.query);
    if (result.success) {
      res.status(200).send("OK");
    } else {
      res.status(400).send("FAIL");
    }
  } catch (error) {
    console.error("Lỗi khi xử lý IPN VNPay:", error);
    res.status(500).json({ error: error.message });
  }
};
