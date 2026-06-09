import * as orderService from "../services/orderService.js";
import { sendControllerError } from "../utils/controllerError.js";

export const createOrder = async (req, res) => {
  try {
    const result = await orderService.createOrder(req.body);
    return res.status(201).json(result);
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
