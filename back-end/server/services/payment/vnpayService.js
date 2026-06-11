import mongoose from "mongoose";
import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import EventStore from "../../models/EventStore.js";
import { verifySecureHash, creatPaymentUrl } from "../../utils/vnpayUtils.js";
import { createServiceError } from "../../utils/serviceError.js";
import { getNextGlobalSequence } from "../../services/sequenceGenerator.js";
import { enqueueEventForProjection } from "../../queues/projectionQueue.js";

/**
 * Tạo link thanh toán VNPay cho một đơn hàng.
 * Controller sẽ gọi hàm này và redirect khách tới URL trả về.
 */
export const initiateVNPayPayment = async ({
  orderId,
  amount,
  orderInfo,
  ipAddr,
  bankCode,
}) => {
  //Kiểm tra đơn hàng tồn tại trong DB trước khi tạo link
  const order = await Order.findById(orderId);
  if (!order) throw createServiceError("Đơn hàng không tồn tại", 404);
  if (order.payment_status === "paid") throw createServiceError("Đơn hàng đã được thanh toán", 400);

  // Pre-create Payment record if it doesn't exist
  let payment = await Payment.findOne({ order_id: orderId, method: "VNPAY" });
  if (!payment) {
    await Payment.create({
      order_id: orderId,
      user_id: order.user_id,
      payment_code: orderId,
      amount: amount || order.total_price,
      method: "VNPAY",
      status: "pending",
    });
  }
  
  const paymentUrl = creatPaymentUrl({
    amount: amount || order.total_price,
    orderId: orderId,
    orderInfo: orderInfo || `Thanh toán đơn hàng ${orderId}`,
    ipAddr: ipAddr,
    bankCode: bankCode,
  });
  
  return paymentUrl;
};

/**
 * Xử lý kết quả khi VNPAY redirect khách về ReturnURL.
 * Chỉ dùng để HIỂN THỊ kết quả cho khách — KHÔNG cập nhật DB ở đây.
 * Việc cập nhật DB thực hiện ở IPN (handleIPN) để đảm bảo chắc chắn hơn.
 */
export const handleReturn = async (query) => {
  const isValid = verifySecureHash(query);
  if (!isValid) {
    return { success: false, message: "Dữ liệu không hợp lệ (chữ ký sai)" };
  }

  const responseCode  = query["vnp_ResponseCode"];
  const orderId       = query["vnp_TxnRef"];
  const amount        = parseInt(query["vnp_Amount"], 10) / 100;
  const transactionNo = query["vnp_TransactionNo"]; // ✅ Fix: TransactionNo (không phải TransactionStatus)

  if (responseCode === "00") {
    // Save payment event and project immediately as a fallback and to support local development
    const correlationId = `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session = await mongoose.startSession();
    let newEvents = [];
    try {
      await session.withTransaction(async () => {
        const events = await EventStore.find({ aggregateId: orderId }).session(session);
        if (events.length > 0) {
          const orderPlacedEvent = events.find((e) => e.eventType === "OrderPlaced");
          if (orderPlacedEvent) {
            const hasPayment = events.some((e) => e.eventType === "PaymentReceived");
            const hasCancellation = events.some((e) => e.eventType === "OrderCancelled");
            const idempotencyKey = transactionNo ? `webhook:vnpay:${transactionNo}` : null;
            
            let isDuplicate = false;
            if (idempotencyKey) {
              isDuplicate = events.some((e) => e.idempotencyKey === idempotencyKey);
            }

            if (!hasPayment && !isDuplicate) {
              const latestOrderEvent = events[events.length - 1];
              const nextOrderVersion = latestOrderEvent.version + 1;
              const eventType = !hasCancellation ? "PaymentReceived" : "PaymentRefundFlagged";
              const seqPaymentEvent = await getNextGlobalSequence();
              const paymentEvent = new EventStore({
                aggregateId: orderId,
                aggregateType: "Order",
                version: nextOrderVersion,
                eventType,
                globalSequence: seqPaymentEvent,
                correlationId,
                causationId: transactionNo || correlationId,
                idempotencyKey,
                payload: {
                  orderId,
                  txnId: transactionNo,
                  amount,
                  method: "VNPAY",
                  rawPayload: query,
                },
              });
              await paymentEvent.save({ session });
              newEvents.push(paymentEvent);
            }
          }
        }
      });
    } catch (err) {
      if (err.code !== 11000 && !err.message.includes("E11000")) {
        console.error("Error processing payment in handleReturn:", err);
      }
    } finally {
      session.endSession();
    }

    for (const event of newEvents) {
      await enqueueEventForProjection(event);
    }

    return {
      success: true,
      message: `Thanh toán thành công cho đơn hàng ${orderId} với số tiền ${amount.toLocaleString("vi-VN")} VND`, // ✅ Fix: format số tiền → 25.000 VND
      orderId,
      amount,
      transactionNo,
    };
  }

  return {
    success: false,
    message: getErrorMessage(responseCode), // ✅ Nên dùng hàm map mã lỗi
    orderId,
    amount,
    responseCode,
  };
};

// Thêm hàm này vào cùng file
function getErrorMessage(code) {
  const errors = {
    "07": "Giao dịch bị nghi ngờ gian lận",
    "09": "Thẻ chưa đăng ký Internet Banking",
    "10": "Xác thực thông tin thẻ sai quá 3 lần",
    "11": "Hết thời gian chờ thanh toán",
    "12": "Thẻ bị khóa",
    "13": "Sai mật khẩu OTP",
    "24": "Khách hàng hủy giao dịch",
    "51": "Không đủ số dư",
    "65": "Vượt hạn mức giao dịch trong ngày",
    "75": "Ngân hàng đang bảo trì",
    "99": "Lỗi không xác định",
  };
  return errors[code] || `Thanh toán thất bại (mã lỗi: ${code})`;
}

/**
 * Xử lý IPN — VNPAY server gọi vào để xác nhận giao dịch.
 * Đây là nơi DUY NHẤT nên cập nhật trạng thái đơn hàng trong DB.
 * VNPAY yêu cầu response phải trả về trong 5 giây.
 */
export const handleIPN = async (query) => {
  const isValid = verifySecureHash(query);
  if (!isValid) {
    return {
      success: false,
      RspCode: "97",
      message: "Dữ liệu không hợp lệ (chữ ký sai)",
    };
  }

  const orderId = query["vnp_TxnRef"];
  const responseCode = query["vnp_ResponseCode"];
  const amount = parseInt(query["vnp_Amount"], 10) / 100;
  const transactionNo = query["vnp_TransactionNo"] || query["vnp_TransactionStatus"];
  const correlationId = `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const session = await mongoose.startSession();
  let newEvents = [];

  try {
    let rspCode = "00";
    let message = "Giao dịch thành công";
    let success = true;

    await session.withTransaction(async () => {
      newEvents = [];

      const events = await EventStore.find({ aggregateId: orderId }).session(session);
      if (events.length === 0) {
        rspCode = "01";
        message = "Đơn hàng không tồn tại";
        success = false;
        return;
      }

      const orderPlacedEvent = events.find((e) => e.eventType === "OrderPlaced");
      if (!orderPlacedEvent) {
        rspCode = "01";
        message = "Đơn hàng không tồn tại (OrderPlaced missing)";
        success = false;
        return;
      }

      const expectedAmount = orderPlacedEvent.payload.total_price;
      if (expectedAmount !== amount) {
        rspCode = "04";
        message = "Số tiền không khớp";
        success = false;
        return;
      }

      const hasPayment = events.some((e) => e.eventType === "PaymentReceived");
      const hasCancellation = events.some((e) => e.eventType === "OrderCancelled");

      if (hasPayment) {
        rspCode = "02";
        message = "Đơn hàng đã được xử lý";
        success = true;
        return;
      }

      const latestOrderEvent = events[events.length - 1];
      const nextOrderVersion = latestOrderEvent.version + 1;

      const isPaid = responseCode === "00";
      const eventType = (isPaid && !hasCancellation) ? "PaymentReceived" : "PaymentRefundFlagged";
      const idempotencyKey = transactionNo ? `webhook:vnpay:${transactionNo}` : null;

      // Check for duplicate idempotencyKey in event history
      if (idempotencyKey) {
        const isDuplicate = events.some((e) => e.idempotencyKey === idempotencyKey);
        if (isDuplicate) {
          rspCode = "02";
          message = "Đơn hàng đã được xử lý";
          success = true;
          return;
        }
      }

      const seqPaymentEvent = await getNextGlobalSequence();
      const paymentEvent = new EventStore({
        aggregateId: orderId,
        aggregateType: "Order",
        version: nextOrderVersion,
        eventType,
        globalSequence: seqPaymentEvent,
        correlationId,
        causationId: transactionNo || correlationId,
        idempotencyKey,
        payload: {
          orderId,
          txnId: transactionNo,
          amount,
          method: "VNPAY",
          rawPayload: query,
        },
      });
      await paymentEvent.save({ session });
      newEvents.push(paymentEvent);
    });

    if (!success) {
      return { success: false, RspCode: rspCode, message };
    }
  } catch (error) {
    if (error.code === 11000 || error.message.includes("E11000")) {
      return {
        success: true,
        RspCode: "00",
        message: "Cập nhật đơn hàng thành công (Giao dịch trùng lặp được bỏ qua)",
      };
    }
    throw error;
  } finally {
    session.endSession();
  }

  for (const event of newEvents) {
    await enqueueEventForProjection(event);
  }

  return {
    success: true,
    RspCode: "00",
    message: "Cập nhật đơn hàng thành công",
  };
};

/**
 * Map mã lỗi VNPAY sang thông báo tiếng Việt.
 */
// export const getErrorMessage = (code) => {
//   const errors = {
//     "07": "Giao dịch bị nghi ngờ gian lận",
//     "09": "Thẻ chưa đăng ký Internet Banking",
//     "10": "Xác thực thông tin thẻ sai quá 3 lần",
//     "11": "Hết thời gian chờ thanh toán",
//     "12": "Thẻ bị khóa",
//     "13": "Sai mật khẩu OTP",
//     "24": "Khách hàng hủy giao dịch",
//     "51": "Không đủ số dư",
//     "65": "Vượt hạn mức giao dịch trong ngày",
//     "75": "Ngân hàng đang bảo trì",
//     "79": "Sai mật khẩu thanh toán quá số lần quy định",
//     "99": "Lỗi không xác định",
//   };
//   return errors[code] || `Thanh toán thất bại (mã: ${code})`;
// }


