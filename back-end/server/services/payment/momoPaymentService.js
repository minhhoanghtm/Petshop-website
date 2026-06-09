import mongoose from "mongoose";
import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import EventStore from "../../models/EventStore.js";
import MomoPaymentStrategy from "./momoStrategy.js";
import { getNextGlobalSequence } from "../../services/sequenceGenerator.js";
import { enqueueEventForProjection } from "../../queues/projectionQueue.js";
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
  const correlationId = `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const orderId = payment.order_id.toString();
  const idempotencyKey = payload.transId ? `webhook:momo:${payload.transId}` : null;

  const session = await mongoose.startSession();
  let newEvents = [];

  try {
    await session.withTransaction(async () => {
      newEvents = [];

      const events = await EventStore.find({ aggregateId: orderId }).session(session);
      
      // If payment event was already appended under this idempotencyKey, abort transaction
      if (idempotencyKey) {
        const isDuplicate = events.some((e) => e.idempotencyKey === idempotencyKey);
        if (isDuplicate) {
          logger.info(`[MomoIpn] Duplicate payment webhook event for idempotencyKey ${idempotencyKey}. Aborting transaction.`);
          return;
        }
      }

      const latestOrderEvent = events[events.length - 1];
      const nextOrderVersion = latestOrderEvent ? latestOrderEvent.version + 1 : 1;

      const hasCancellation = events.some((e) => e.eventType === "OrderCancelled");
      const eventType = (isPaid && !hasCancellation) ? "PaymentReceived" : "PaymentRefundFlagged";

      const seqPaymentEvent = await getNextGlobalSequence();
      const paymentEvent = new EventStore({
        aggregateId: orderId,
        aggregateType: "Order",
        version: nextOrderVersion,
        eventType,
        globalSequence: seqPaymentEvent,
        correlationId,
        causationId: payload.transId ? String(payload.transId) : correlationId,
        idempotencyKey,
        payload: {
          orderId,
          txnId: payload.transId ? String(payload.transId) : null,
          amount: payload.amount,
          method: "MOMO",
          rawPayload: payload,
        },
      });
      await paymentEvent.save({ session });
      newEvents.push(paymentEvent);
    });
  } catch (error) {
    // Check for DuplicateKey error (code 11000)
    if (error.code === 11000 || error.message.includes("E11000")) {
      logger.info(`[MomoIpn] Duplicate payment webhook event for txnId ${payload.transId} (DuplicateKey error caught). Returning success.`);
      return {
        success: true,
        status: isPaid ? "paid" : "failed",
        paymentCode: payment.payment_code,
      };
    }
    throw error;
  } finally {
    session.endSession();
  }

  for (const event of newEvents) {
    await enqueueEventForProjection(event);
  }

  const finalStatus = isPaid ? "paid" : "failed";
  return {
    success: true,
    status: finalStatus,
    paymentCode: payment.payment_code,
  };
};
