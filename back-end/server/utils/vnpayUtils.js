import crypto from "crypto";
import qs from "qs";
import moment from "moment";
import { logger } from "../logger/logger.js";

/**
 * Sắp xếp object theo thứ tự alphabet của key.
 * VNPAY yêu cầu các tham số phải được sort trước khi tạo chữ ký,
 * nếu không sort đúng → checksum sai → thanh toán thất bại.
 */
function sortObject(obj) {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      const value = obj[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        sorted[key] = encodeURIComponent(String(value)).replace(/%20/g, "+");
      }
    });
  return sorted;
}

const VNPAY_SECRET = (
  process.env.VNPAY_SECRET_KEY || process.env.VNP_HASHSECRET || ""
).trim();
const VNPAY_TMN_CODE = (
  process.env.VNPAY_TMNCODE || process.env.VNP_TMNCODE || ""
).trim();
const VNPAY_URL = (
  process.env.VNPAY_URL || process.env.VNP_URL || ""
).trim();
const VNPAY_RETURN_URL = (
  process.env.VNPAY_RETURN_URL || process.env.VNP_RETURNURL || ""
).trim();

/**
 * Tạo chữ ký HMAC-SHA512.
 * VNPAY dùng chữ ký này để xác minh dữ liệu không bị giả mạo.
 * @param {string} data - Chuỗi query string đã sort
 * @returns {string} - Chữ ký hex
 */
function createSignature(data) {
  if (!VNPAY_SECRET) {
    throw new Error(
      "VNPAY secret key is not configured. Set VNPAY_SECRET_KEY or VNP_HASHSECRET."
    );
  }

  return crypto
    .createHmac("sha512", VNPAY_SECRET)
    .update(Buffer.from(data, "utf-8"))
    .digest("hex");
}

/**
 * Tạo URL thanh toán để redirect khách sang cổng VNPAY.
 * @param {Object} options
 * @param {number} options.amount     - Số tiền (VND), ví dụ: 50000
 * @param {string} options.orderId    - Mã đơn hàng duy nhất
 * @param {string} options.orderInfo  - Mô tả đơn hàng
 * @param {string} options.ipAddr     - IP của khách hàng
 * @param {string} [options.bankCode] - Mã ngân hàng (tùy chọn)
 * @param {string} [options.locale]   - Ngôn ngữ: 'vn' hoặc 'en'
 * @returns {string} - URL đầy đủ để redirect
 */
export const creatPaymentUrl = ({
  amount,
  orderId,
  orderInfo,
  ipAddr,
  bankCode,
  locale,
}) => {
  if (!VNPAY_TMN_CODE) {
    throw new Error(
      "VNPAY TMN code is not configured. Set VNPAY_TMNCODE or VNP_TMNCODE."
    );
  }

  if (!VNPAY_URL) {
    throw new Error(
      "VNPAY URL is not configured. Set VNPAY_URL or VNP_URL."
    );
  }

  if (!VNPAY_RETURN_URL) {
    throw new Error(
      "VNPAY return URL is not configured. Set VNPAY_RETURN_URL or VNP_RETURNURL."
    );
  }

  const cleanAmount = Math.round(Number(amount || 0));
  let ip = ipAddr || "127.0.0.1";
  if (ip.includes(":") || ip === "::1" || ip.includes("::ffff:")) {
    ip = "127.0.0.1";
  }

  let params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: VNPAY_TMN_CODE,
    vnp_Amount: cleanAmount * 100, // VNPAY tính theo đơn vị nhỏ nhất (đồng → xu)
    vnp_CurrCode: "VND",
    vnp_TxnRef: orderId,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_Locale: locale || "vn",
    vnp_ReturnUrl: VNPAY_RETURN_URL,
    vnp_IpAddr: ip,
    vnp_CreateDate: moment().format("YYYYMMDDHHmmss"),
  };

  //Chỉ thêm bankCode khi có, nếu không có thì để khách tự chọn trên giao diện VNPAY
  if (bankCode) {
    params.vnp_BankCode = bankCode;
  }

  //Bắt buộc sort trước khi tạo chữ ký
  params = sortObject(params);

  //Tạo query string từ object đã sort
  const queryString = qs.stringify(params, { encode: false });
  const secureHash = createSignature(queryString);

  //Gắn chữ ký vào cuối query string
  params.vnp_SecureHash = secureHash;

  //Tạo URL hoàn chỉnh
  const paymentUrl = `${VNPAY_URL}?${qs.stringify(params, { encode: false })}`;
  logger.info("=== VNPAY DEBUG ===", {
    TmnCode: process.env.VNP_TMNCODE,
    Amount: cleanAmount * 100,
    CreateDate: moment().format('YYYYMMDDHHmmss'),
    SignData: queryString,
    SecureHash: secureHash,
    PaymentUrl: paymentUrl,
  });
  return paymentUrl;
};

/**
 * Tạo URL thanh toán để redirect khách sang cổng VNPAY.
 * @param {Object} options
 * @param {number} options.amount     - Số tiền (VND), ví dụ: 50000
 * @param {string} options.orderId    - Mã đơn hàng duy nhất
 * @param {string} options.orderInfo  - Mô tả đơn hàng
 * @param {string} options.ipAddr     - IP của khách hàng
 * @param {string} [options.bankCode] - Mã ngân hàng (tùy chọn)
 * @param {string} [options.locale]   - Ngôn ngữ: 'vn' hoặc 'en'
 * @returns {string} - URL đầy đủ để redirect
 */
export const verifySecureHash = (vnpParams) => {
  //Tách chữ ký ra khỏi params truowcskhi verify
  const secureHash = vnpParams["vnp_SecureHash"];

  //Clone để không làm thay đổi object gốc
  const params = { ...vnpParams };

  //Xóa trường chữ ký trước khi tạo lại chữ ký để so sánh
  delete params["vnp_SecureHash"];
  delete params["vnp_SecureHashType"]; // Nếu có trường này cũng nên xóa

  //Bắt buộc sort trước khi tạo chữ ký
  const sortedParams = sortObject(params);
  const signData = qs.stringify(sortedParams, { encode: false });
  const expectedHash = createSignature(signData);
  return expectedHash === secureHash;
};
