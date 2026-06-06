import axiosInstance from "../utils/axiosInstance";

export const createMomoPayment = (orderId) =>
  axiosInstance.post("/api/payments/momo/create", { orderId });
