import axiosInstance from "../utils/axiosInstance";

export const createOrder = (orderData) => axiosInstance.post("/api/orders", orderData);

export const fetchOrders = (params) => axiosInstance.get("/api/orders", { params });

export const fetchOrdersByUser = (userId) =>
  axiosInstance.get(`/api/orders?user_id=${userId}`);

export const fetchOrderStats = () => axiosInstance.get("/api/orders/stats");

export const updateOrder = (orderId, payload) =>
  axiosInstance.put(`/api/orders/${orderId}`, payload);

export const deleteOrder = (orderId) => axiosInstance.delete(`/api/orders/${orderId}`);