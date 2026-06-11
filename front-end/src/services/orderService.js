import axiosInstance from "../utils/axiosInstance";

export const createOrder = (orderData, config = {}) => axiosInstance.post("/api/orders", orderData, config);

export const fetchOrders = (params) => axiosInstance.get("/api/orders", { params });

export const fetchOrdersByUser = (userId) =>
  axiosInstance.get(`/api/orders?user_id=${userId}`);

export const fetchOrderStats = () => axiosInstance.get("/api/orders/stats");

export const updateOrder = (orderId, payload) =>
  axiosInstance.put(`/api/orders/${orderId}`, payload);

export const deleteOrder = (orderId) => axiosInstance.delete(`/api/orders/${orderId}`);

export const reserveCheckoutStock = (items) =>
  axiosInstance.post("/api/orders/checkout/reserve", { items });

export const refreshCheckoutStock = () =>
  axiosInstance.post("/api/orders/checkout/refresh");

export const releaseCheckoutStock = () =>
  axiosInstance.post("/api/orders/checkout/release");