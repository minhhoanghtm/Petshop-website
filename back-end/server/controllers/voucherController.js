import * as voucherService from "../services/voucherService.js";
import { sendControllerError } from "../utils/controllerError.js";

// ================= ADMIN CONTROLLERS =================

export const createVoucher = async (req, res) => {
  try {
    const voucher = await voucherService.createVoucher(req.body, req.user, req);
    return res.status(201).json(voucher);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const updateVoucher = async (req, res) => {
  try {
    const voucher = await voucherService.updateVoucher(req.params.id, req.body, req.user, req);
    return res.status(200).json(voucher);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const softDeleteVoucher = async (req, res) => {
  try {
    const result = await voucherService.softDeleteVoucher(req.params.id, req.user, req);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const toggleVoucherActive = async (req, res) => {
  try {
    const voucher = await voucherService.toggleVoucherActive(req.params.id, req.body.isActive, req.user, req);
    return res.status(200).json(voucher);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const getVoucherStats = async (req, res) => {
  try {
    const stats = await voucherService.getVoucherStats();
    return res.status(200).json(stats);
  } catch (error) {
    return sendControllerError(res, error, 500);
  }
};

export const getVoucherHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const history = await voucherService.getVoucherHistory(req.params.id, page, limit);
    return res.status(200).json(history);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

// ================= USER CONTROLLERS =================

export const getPublicVouchers = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const isAdmin = req.query.admin === "true" && (req.user?.role === "admin" || req.user?.role === "superadmin");
    const vouchers = await voucherService.getPublicVouchers(userId, isAdmin);
    return res.status(200).json(vouchers);
  } catch (error) {
    return sendControllerError(res, error, 500);
  }
};


export const claimVoucher = async (req, res) => {
  try {
    const voucherIdOrCode = req.body.voucherId || req.body.code;
    const result = await voucherService.claimVoucher(req.user._id, voucherIdOrCode, req);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const getUserWallet = async (req, res) => {
  try {
    const status = req.query.status || "available";
    const wallet = await voucherService.getUserWallet(req.user._id, status);
    return res.status(200).json(wallet);
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};

export const applyVoucher = async (req, res) => {
  try {
    const { code, items, shippingCost, deliveryOption } = req.body;
    const result = await voucherService.validateAndCalculateVoucher(
      req.user._id,
      code,
      items,
      shippingCost,
      deliveryOption
    );
    
    // Log security event VOUCHER_APPLIED
    // Note: Logging security event for apply is good for tracking and audit
    
    return res.status(200).json({
      voucherId: result.voucher._id,
      code: result.voucher.code,
      discountAmount: result.discountAmount,
      totalSubtotal: result.totalSubtotal,
    });
  } catch (error) {
    return sendControllerError(res, error, 400);
  }
};
