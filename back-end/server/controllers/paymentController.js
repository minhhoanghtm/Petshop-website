import * as momoService from "../services/payment/momoPaymentService.js";
import { sendControllerError } from "../utils/controllerError.js";

export const createMomoPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const result = await momoService.createMomoPayment(orderId, req.user);
    return res.status(201).json(result);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const momoIpn = async (req, res) => {
  try {
    const result = await momoService.handleMomoIpn(req.body);
    return res.status(200).json({ resultCode: 0, message: "IPN MOMO đã được xử lý.", data: result });
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};
