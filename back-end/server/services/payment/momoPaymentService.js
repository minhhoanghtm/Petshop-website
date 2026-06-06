import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import MomoPaymentStrategy from "./momoStrategy.js";
import { createServiceError } from "../../utils/serviceError.js";

// Khởi tạo chiến lược thanh toán MOMO
const momoStrategy = new MomoPaymentStrategy();

// API để tạo yêu cầu thanh toán MOMO
export const createMomoPayment = async (orderId, user) => {
  if (!orderId) {
    throw createServiceError("orderId là bắt buộc.", 400);
  }

  // Tìm đơn hàng và kiểm tra quyền truy cập
  const order = await Order.findById(orderId).populate("user_id");
  if (!order) {
    throw createServiceError("Không tìm thấy đơn hàng.", 404);
  }

  // Kiểm tra xem người dùng có phải là chủ sở hữu đơn hàng hoặc có vai trò admin hay không
  const isOwner = String(order.user_id?._id) === String(user._id);
  if (!isOwner && user.role !== "admin") {
    throw createServiceError("Bạn không có quyền truy cập đơn hàng này.", 403);
  }


  // Kiểm tra trạng thái thanh toán và phương thức thanh toán hiện tại của đơn hàng
  let paymentMethod = String(order.payment_method || "").trim().toUpperCase();
  const paymentStatus = String(order.payment_status || "pending").trim().toLowerCase();
  const orderStatus = String(order.status || "pending").trim().toLowerCase();

  //Nếu chưa có phương thức thanh toán tì mặc định là MOMO
  if (!paymentMethod) {
    order.payment_method = "MOMO";
    order.payment_status = "pending";
    await order.save();
    paymentMethod = "MOMO";
  }


  //Kiểm tra đã thanh toán chưa
  if (paymentStatus === "paid") {
    throw createServiceError("Đơn hàng đã được thanh toán.", 400);
  }

  // Nếu phương thức thanh toán hiện tại không phải là MOMO, chúng ta sẽ chuyển đổi nó sang MOMO (nếu đơn hàng đang ở trạng thái pending hoặc confirmed)
  if (paymentMethod !== "MOMO") {
    if (!["pending", "confirmed"].includes(orderStatus)) {
      throw createServiceError("Đơn hàng không hợp lệ để chuyển đổi sang MOMO.", 400);
    }

    order.payment_method = "MOMO";
    order.payment_status = "pending";
    await order.save();
    paymentMethod = "MOMO";
  }

  // Kiểm tra xem đã tồn tại yêu cầu thanh toán MOMO nào đang chờ xử lý cho đơn hàng này chưa
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

  // Tạo yêu cầu thanh toán MOMO mới
  const momoResponse = await momoStrategy.createPayment(order, user);

  // Lưu thông tin thanh toán vào cơ sở dữ liệu
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


  // Trả về thông tin thanh toán MOMO cho client
  return {
    paymentCode: payment.payment_code,
    orderId: order._id,
    payUrl: momoResponse.responseData.payUrl,
    deeplink: momoResponse.responseData.deeplink,
    qrCodeUrl: momoResponse.responseData.qrCodeUrl,
  };
};

// Hàm xử lý IPN từ MOMO
export const handleMomoIpn = async (payload = {}) => {
  if (!payload || typeof payload !== "object") {
    throw createServiceError("Dữ liệu IPN không hợp lệ.", 400);
  }
  //Nếu không có verify thì không thể xác thực được tính hợp lệ của IPN, do đó sẽ từ chối xử lý
  if (!momoStrategy.verifyCallback(payload)) {
    throw createServiceError("Chữ ký MoMo không hợp lệ.", 400);
  }

  // Tìm thông tin thanh toán dựa trên extraData (payment_code) hoặc orderId từ payload
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
