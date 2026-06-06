import axios from "axios";
import crypto from "crypto";
import PaymentStrategy from "./paymentStrategy.js";
import { createServiceError } from "../../utils/serviceError.js";
import {
  buildMomoCreateRawSignature,
  generateMomoSignature,
  verifyMomoSignature,
} from "../../utils/momoUtils.js";

export class MomoPaymentStrategy extends PaymentStrategy {
  constructor() {
    super();
    this.partnerCode = process.env.MOMO_PARTNER_CODE;
    this.accessKey = process.env.MOMO_ACCESS_KEY;
    this.secretKey = process.env.MOMO_SECRET_KEY;
    this.endpoint = process.env.MOMO_ENDPOINT;
    this.redirectUrl = process.env.MOMO_REDIRECT_URL;
    this.ipnUrl = process.env.MOMO_IPN_URL;
    this.requestType = "captureWallet";
  }

  get config() {
    if (!this.partnerCode || !this.accessKey || !this.secretKey || !this.endpoint || !this.redirectUrl || !this.ipnUrl) {
      throw createServiceError("Thiết lập Momo chưa đầy đủ trong biến môi trường", 500);
    }

    return {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      secretKey: this.secretKey,
      endpoint: this.endpoint.replace(/\/$/, ""),
      redirectUrl: this.redirectUrl,
      ipnUrl: this.ipnUrl,
      requestType: this.requestType,
    };
  }

  async createPayment(order, user) {
    if (!order || !order._id) {
      throw createServiceError("Order không hợp lệ", 400);
    }

    const config = this.config;
    const orderId = order._id.toString();
    const requestId = `MOMO_${orderId}_${Date.now()}`;
    const extraData = `MOMO_${orderId}_${Date.now()}`;
    const amount = String(order.total_price || order.totalPrice || 0);
    const orderInfo = `Thanh toán đơn hàng ${orderId}`;

    const requestPayload = {
      partnerCode: config.partnerCode,
      accessKey: config.accessKey,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl: config.redirectUrl,
      ipnUrl: config.ipnUrl,
      extraData,
      requestType: config.requestType,
    };

    requestPayload.signature = generateMomoSignature(buildMomoCreateRawSignature(requestPayload), config.secretKey);

    const response = await axios.post(`${config.endpoint}/v2/gateway/api/create`, requestPayload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    if (!response?.data) {
      throw createServiceError("Không nhận được phản hồi từ Momo", 502);
    }

    const responseBody = response.data;
    if (Number(responseBody.resultCode) !== 0) {
      throw createServiceError(`Momo trả về lỗi: ${responseBody.message || responseBody.localMessage}`, 502, responseBody);
    }

    return {
      payUrl: responseBody.payUrl,
      deeplink: responseBody.deeplinkUrl || responseBody.deeplink,
      qrCodeUrl: responseBody.qrCodeUrl,
      responseData: responseBody,
      requestPayload,
      extraData,
      orderId,
      requestId,
    };
  }

  verifyCallback(payload) {
    if (!payload || typeof payload !== "object") {
      throw createServiceError("Dữ liệu callback MoMo không hợp lệ", 400);
    }

    const config = this.config;
    return verifyMomoSignature(payload, config.secretKey);
  }

  async processPayment(amount, orderDetails) {
    // Với chiến lược Momo, bước thực tế tạo thanh toán sẽ được thực hiện trong API riêng.
    return {
      success: true,
      payment_status: "pending",
      transactionId: null,
    };
  }
}

export default MomoPaymentStrategy;
