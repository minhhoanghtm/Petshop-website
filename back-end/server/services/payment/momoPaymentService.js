import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import MomoPaymentStrategy from "./momoStrategy.js";
import { createServiceError } from "../../utils/serviceError.js";

const momoStrategy = new MomoPaymentStrategy();

export const createMomoPayment = async (orderId, user) => {
  if (!orderId) {
    throw createServiceError("orderId là bắt buộc.", 400);
  }

  const order = await Order.findById(orderId).populate("user_id");
  if (!order) {
    throw createServiceError("Không tìm thấy đơn hàng.", 404);
  }

  const isOwner = String(order.user_id?._id) === String(user._id);
  if (!isOwner && user.role !== "admin") {
    throw createServiceError("Bạn không có quyền truy cập đơn hàng này.", 403);
  }

  let paymentMethod = String(order.payment_method || "").trim().toUpperCase();
  const paymentStatus = String(order.payment_status || "pending").trim().toLowerCase();
  const orderStatus = String(order.status || "pending").trim().toLowerCase();

  if (!paymentMethod) {
    order.payment_method = "MOMO";
    order.payment_status = "pending";
    await order.save();
    paymentMethod = "MOMO";
  }

  if (paymentStatus === "paid") {
    throw createServiceError("Đơn hàng đã được thanh toán.", 400);
  }

  if (paymentMethod !== "MOMO") {
    if (!["pending", "confirmed"].includes(orderStatus)) {
      throw createServiceError("Đơn hàng không hợp lệ để chuyển đổi sang MOMO.", 400);
    }

    order.payment_method = "MOMO";
    order.payment_status = "pending";
    await order.save();
    paymentMethod = "MOMO";
  }

  const existingPendingPayment = await Payment.findOne({
    order_id: order._id,
    method: "MOMO",
    status: "pending",
  }).sort({ createdAt: -1 });

  if (existingPendingPayment && existingPendingPayment.provider_response?.momoResponse?.payUrl) {
    return {
      paymentCode: existingPendingPayment.payment_code,
      orderId: order._id,
      payUrl: existingPendingPayment.provider_response.momoResponse.payUrl,
      deeplink: existingPendingPayment.provider_response.momoResponse.deeplink,
      qrCodeUrl: existingPendingPayment.provider_response.momoResponse.qrCodeUrl,
      message: "Đã tồn tại yêu cầu thanh toán MOMO đang chờ xử lý.",
    };
  }

  const momoResponse = await momoStrategy.createPayment(order, user);

  const payment = await Payment.create({
    order_id: order._id,
    user_id: user._id,
    payment_code: momoResponse.extraData,
    amount: Number(order.total_price || 0),
    method: "MOMO",
    status: "pending",
    provider_response: {
      momoRequest: momoResponse.requestPayload,
      momoResponse: momoResponse.responseData,
    },
  });

  return {
    paymentCode: payment.payment_code,
    orderId: order._id,
    payUrl: momoResponse.responseData.payUrl,
    deeplink: momoResponse.responseData.deeplink,
    qrCodeUrl: momoResponse.responseData.qrCodeUrl,
  };
};

export const handleMomoIpn = async (payload = {}) => {
  if (!payload || typeof payload !== "object") {
    throw createServiceError("Dữ liệu IPN không hợp lệ.", 400);
  }

  if (!momoStrategy.verifyCallback(payload)) {
    throw createServiceError("Chữ ký MoMo không hợp lệ.", 400);
  }

  let payment = null;
  if (payload.extraData) {
    payment = await Payment.findOne({ payment_code: payload.extraData, method: "MOMO" });
  }

  if (!payment && payload.orderId) {
    payment = await Payment.findOne({ order_id: payload.orderId, method: "MOMO" }).sort({ createdAt: -1 });
  }

  if (!payment) {
    throw createServiceError("Không tìm thấy thông tin thanh toán MOMO tương ứng.", 404);
  }

  if (payment.status === "paid") {
    return {
      message: "Payment MOMO đã được xử lý trước đó.",
      paymentCode: payment.payment_code,
    };
  }

  const isPaid = Number(payload.resultCode) === 0;
  const updatePayload = {
    provider_transaction_id: payload.transId ? String(payload.transId) : payment.provider_transaction_id,
    provider_response: payload,
    status: isPaid ? "paid" : "failed",
    paid_at: isPaid ? new Date() : payment.paid_at,
  };

  await Payment.findByIdAndUpdate(payment._id, updatePayload, { new: true });

  if (isPaid) {
    await Order.findByIdAndUpdate(payment.order_id, { payment_status: "paid" });
  }

  return {
    success: true,
    status: updatePayload.status,
    paymentCode: payment.payment_code,
  };
};
