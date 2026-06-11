import * as orderService from "../services/orderService.js";
import * as checkoutReservationService from "../services/checkoutReservationService.js";
import { sendControllerError } from "../utils/controllerError.js";

export const createOrder = async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      user_id: req.user?._id || req.user?.id || req.body.user_id,
    };
    const result = await orderService.createOrder(orderData);
    return res.status(201).json(result);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const reserveCheckoutStock = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Danh sách sản phẩm giữ hàng không hợp lệ." });
    }
    const result = await checkoutReservationService.reserveCheckoutStock(userId, items);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const refreshCheckoutStock = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const result = await checkoutReservationService.refreshCheckoutStock(userId);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const releaseCheckoutStock = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    await checkoutReservationService.releaseCheckoutStock(userId);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};



export const getOrders = async (req, res) => {
  try {
    const result = await orderService.getOrders(req.query, req.user, req.pagination);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, 404);
  }
};

export const getOrderById = async (req, res) => {
  try {
    const result = await orderService.getOrderById(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, 404);
  }
};

export const updateOrder = async (req, res) => {
  try {
    const result = await orderService.updateOrder(req.params.id, req.body, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const result = await orderService.deleteOrder(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const getOrderStats = async (req, res) => {
  try {
    const result = await orderService.getOrderStats(req.query.timeFilter);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, 500);
  }
};

export const getRecentOrders = async (req, res) => {
  try {
    const result = await orderService.getRecentOrders(req.query.limit);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, 500);
  }
};
