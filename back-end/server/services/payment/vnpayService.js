import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import { verifySecureHash, creatPaymentUrl } from "../../utils/vnpayUtils.js";
import { createServiceError } from "../../utils/serviceError.js";

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
  
  const paymentUrl = creatPaymentUrl({
    amount: amount || order.total_price,
    orderId: orderId,
    orderInfo: orderInfo || `Thanh toán đơn hàng ${orderId}`,
    ipAddr: ipAddr,
    bankCode: bankCode,
  });
  
  return paymentUrl;
}

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
  //Verify chữ ký để đảm bảo dữ liệu là từ VNPAY
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
  const amount = parseInt(query["vnp_Amount"], 10) / 100; // VNPAY trả về số tiền đã nhân 100
  const transactionNo = query["vnp_TransactionStatus"]; //Mã giao dịch

  //Tìm đơn hàng trong DB
  const order = await Order.findById(orderId);
  if (!order) {
    return { success: false, RspCode: "01", message: "Đơn hàng không tồn tại" };
  }

  //Kieemr tra số tiền để tránh giả mạo
  if (order.totalAmount !== amount) {
    return { success: false, RspCode: "04", message: "Số tiền không khớp" };
  }

  //Kiểm tra đơn hàng chưa được xử lý
  if (order.status !== "pending") {
    return { success: false, RspCode: "02", message: "Đơn hàng đã được xử lý" };
  }

  //Cập nhật DB
  if (responseCode === "00") {
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: "paid",
      paymentMethod: "vnpay",
      transactionNo,
      paidAt: new Date(),
      status: "confirmed", // Hoặc trạng thái phù hợp sau khi thanh toán thành công
    });
    return {
      success: true,
      RspCode: "00",
      message: "Cập nhật đơn hàng thành công",
    };
  } else {
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: "failed",
      paymentMethod: "vnpay",
      status: "failed",
    });
    return {
      success: false,
      RspCode: "00",
      message: "Cập nhật đơn hàng thất bại do giao dịch không thành công",
    };
  }
}

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


