import axiosInstance from "../utils/axiosInstance";

export const createMomoPayment = async (orderId) => {
  if (!orderId) {
    throw new Error("Order ID is required");
  }
  try {
    const response = await axiosInstance.post("/api/payments/momo/create", { orderId });
    return response;
  } catch (error) {
    console.error("Error creating Momo payment:", error);
    throw error;
  }
};

export const createVNPayPayment = async (orderId, amount) => {
  if (!orderId) {
    throw new Error("Order ID is required");
  }
  try {
    const response = await axiosInstance.post("/api/payments/vnpay/create", { 
      orderId,
      amount: amount
    });
    return response;
  } catch (error) {
    console.error("Error creating VNPay payment:", error);
    throw error;
  }
};