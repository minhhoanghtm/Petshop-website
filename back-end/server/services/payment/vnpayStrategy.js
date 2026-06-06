import PaymentStrategy from "./paymentStrategy.js";
import { createServiceError } from "../../utils/serviceError.js";

export class VnpayPaymentStrategy extends PaymentStrategy {
  async processPayment(amount, orderDetails) {
    // VNPay payment - just mark as pending since payment happens externally
    console.log(`[VNPay] Thanh toán VNPay được khởi tạo cho số tiền: ${amount}đ`);
    
    return {
      success: true,
      payment_status: "pending",
      transactionId: null,
      message: "VNPay payment pending - awaiting customer action"
    };
  }

  async createPayment(order, user) {
    if (!order || !order._id) {
      throw createServiceError("Order không hợp lệ", 400);
    }

    const orderId = order._id.toString();
    const amount = order.total_price || 0;

    return {
      success: true,
      orderId,
      amount,
      orderInfo: `Thanh toán đơn hàng ${orderId}`,
    };
  }

  verifyCallback(payload) {
    // VNPay callback verification is handled in vnpayService
    return true;
  }
}

export default VnpayPaymentStrategy;
