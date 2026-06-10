import mongoose from "mongoose";
import Voucher from "../models/Voucher.js";
import UserVoucher from "../models/UserVoucher.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { logSecurityEvent } from "./securityLogService.js";
import { createServiceError } from "../utils/serviceError.js";
import { logger } from "../logger/logger.js";

/**
 * Service to manage Vouchers (Admin and User actions)
 */

// ================= ADMIN FUNCTIONS =================

export const createVoucher = async (voucherData, adminUser = null, req = null) => {
  const code = String(voucherData.code || "").trim().toUpperCase();
  if (!code) {
    throw createServiceError("Mã voucher không được để trống.", 400);
  }

  const existing = await Voucher.findOne({ code, isDeleted: false });
  if (existing) {
    throw createServiceError("Mã voucher này đã tồn tại.", 400);
  }

  const voucher = new Voucher({
    ...voucherData,
    code,
  });

  await voucher.save();

  await logSecurityEvent({
    event: "VOUCHER_CREATED",
    email: adminUser?.email,
    userId: adminUser?._id,
    ip: req?.ip || req?.headers?.["x-forwarded-for"],
    userAgent: req?.headers?.["user-agent"],
    details: { voucherId: voucher._id, code: voucher.code }
  });

  return voucher;
};

export const updateVoucher = async (voucherId, voucherData, adminUser = null, req = null) => {
  const voucher = await Voucher.findOne({ _id: voucherId, isDeleted: false });
  if (!voucher) {
    throw createServiceError("Voucher không tồn tại.", 404);
  }

  if (voucherData.code) {
    const newCode = String(voucherData.code).trim().toUpperCase();
    if (newCode !== voucher.code) {
      const existing = await Voucher.findOne({ code: newCode, isDeleted: false });
      if (existing) {
        throw createServiceError("Mã voucher mới đã tồn tại.", 400);
      }
      voucher.code = newCode;
    }
  }

  // Update other fields
  const allowedUpdates = [
    "name",
    "description",
    "type",
    "value",
    "maxDiscount",
    "minOrderValue",
    "totalQuantity",
    "usageLimitPerUser",
    "startDate",
    "endDate",
    "applicableProducts",
    "applicableCategories",
    "applicableUserLevels",
    "isPublic",
    "status",
    "restoreVoucherOnCancel",
    "restoreOnlyIfCancelledWithinMinutes",
  ];

  allowedUpdates.forEach((field) => {
    if (voucherData[field] !== undefined) {
      voucher[field] = voucherData[field];
    }
  });

  await voucher.save();

  await logSecurityEvent({
    event: "VOUCHER_UPDATED",
    email: adminUser?.email,
    userId: adminUser?._id,
    ip: req?.ip || req?.headers?.["x-forwarded-for"],
    userAgent: req?.headers?.["user-agent"],
    details: { voucherId: voucher._id, code: voucher.code }
  });

  return voucher;
};

export const softDeleteVoucher = async (voucherId, adminUser = null, req = null) => {
  const voucher = await Voucher.findOne({ _id: voucherId, isDeleted: false });
  if (!voucher) {
    throw createServiceError("Voucher không tồn tại.", 404);
  }

  voucher.isDeleted = true;
  await voucher.save();

  await logSecurityEvent({
    event: "VOUCHER_DEACTIVATED",
    email: adminUser?.email,
    userId: adminUser?._id,
    ip: req?.ip || req?.headers?.["x-forwarded-for"],
    userAgent: req?.headers?.["user-agent"],
    details: { voucherId: voucher._id, code: voucher.code, action: "soft_delete" }
  });

  return { message: "Đã xoá voucher thành công." };
};

export const toggleVoucherActive = async (voucherId, isActive, adminUser = null, req = null) => {
  const voucher = await Voucher.findOne({ _id: voucherId, isDeleted: false });
  if (!voucher) {
    throw createServiceError("Voucher không tồn tại.", 404);
  }

  voucher.status = isActive ? "ACTIVE" : "DISABLED";
  await voucher.save();

  if (!isActive) {
    await logSecurityEvent({
      event: "VOUCHER_DEACTIVATED",
      email: adminUser?.email,
      userId: adminUser?._id,
      ip: req?.ip || req?.headers?.["x-forwarded-for"],
      userAgent: req?.headers?.["user-agent"],
      details: { voucherId: voucher._id, code: voucher.code, action: "disable" }
    });
  }

  return voucher;
};

export const getVoucherStats = async () => {
  const total = await Voucher.countDocuments({ isDeleted: false });
  const active = await Voucher.countDocuments({ isDeleted: false, status: "ACTIVE", startDate: { $lte: new Date() }, endDate: { $gte: new Date() } });
  const expired = await Voucher.countDocuments({ isDeleted: false, endDate: { $lt: new Date() } });
  
  const claimedUsed = await UserVoucher.aggregate([
    {
      $group: {
        _id: null,
        totalClaimed: { $sum: 1 },
        totalUsed: { $sum: { $cond: ["$isUsed", 1, 0] } },
      },
    },
  ]);

  const stats = claimedUsed[0] || { totalClaimed: 0, totalUsed: 0 };

  return {
    totalVouchers: total,
    activeVouchers: active,
    expiredVouchers: expired,
    claimedVouchers: stats.totalClaimed,
    usedVouchers: stats.totalUsed,
  };
};

export const getVoucherHistory = async (voucherId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const query = { voucherId };

  const total = await UserVoucher.countDocuments(query);
  const history = await UserVoucher.find(query)
    .sort({ claimedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "fullName email level");

  return {
    history,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

// ================= USER FUNCTIONS =================

export const getPublicVouchers = async (userId = null, isAdmin = false) => {
  const now = new Date();
  const query = isAdmin
    ? { isDeleted: false }
    : {
        isDeleted: false,
        isPublic: true,
        status: "ACTIVE",
        startDate: { $lte: now },
        endDate: { $gte: now },
      };

  const vouchers = await Voucher.find(query)
    .populate("applicableProducts", "name price")
    .populate("applicableCategories", "name")
    .sort(isAdmin ? { createdAt: -1 } : { startDate: 1 });

  // If user is logged in, attach claim status to each voucher
  if (userId) {
    const userClaims = await UserVoucher.find({ userId });
    
    return vouchers.map((v) => {
      const claimsForThisVoucher = userClaims.filter(
        (uc) => uc.voucherId.toString() === v._id.toString()
      );
      
      const claimedCount = claimsForThisVoucher.length;
      const isUsed = claimsForThisVoucher.some((uc) => uc.isUsed);
      const remainingClaims = Math.max(0, v.usageLimitPerUser - claimedCount);

      return {
        ...v.toObject(),
        userClaimStatus: {
          claimedCount,
          isUsed,
          canClaim: remainingClaims > 0 && v.claimedCount < v.totalQuantity,
        },
      };
    });
  }

  return vouchers.map((v) => ({
    ...v.toObject(),
    userClaimStatus: {
      claimedCount: 0,
      isUsed: false,
      canClaim: v.claimedCount < v.totalQuantity,
    },
  }));
};


export const claimVoucher = async (userId, voucherCodeOrId, req = null) => {
  const now = new Date();
  let query = { isDeleted: false, status: "ACTIVE", startDate: { $lte: now }, endDate: { $gte: now } };

  if (mongoose.Types.ObjectId.isValid(voucherCodeOrId)) {
    query._id = voucherCodeOrId;
  } else {
    query.code = String(voucherCodeOrId).trim().toUpperCase();
  }

  const user = await User.findById(userId);
  if (!user || user.isBlocked) {
    throw createServiceError("Tài khoản không hợp lệ hoặc đã bị khoá.", 403);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // Find voucher
      const voucher = await Voucher.findOne(query).session(session);
      if (!voucher) {
        throw createServiceError("Voucher không tồn tại hoặc đã hết hạn.", 404);
      }

      // Check User Level
      if (voucher.applicableUserLevels && voucher.applicableUserLevels.length > 0) {
        const userLevel = user.level || "standard";
        if (!voucher.applicableUserLevels.includes(userLevel)) {
          throw createServiceError("Voucher này không áp dụng cho cấp bậc tài khoản của bạn.", 400);
        }
      }

      // Check remaining stock
      if (voucher.claimedCount >= voucher.totalQuantity) {
        throw createServiceError("Voucher đã được nhận hết.", 400);
      }

      // Check per-user limit
      const claimCount = await UserVoucher.countDocuments({
        userId,
        voucherId: voucher._id,
      }).session(session);

      if (claimCount >= voucher.usageLimitPerUser) {
        throw createServiceError(`Bạn đã đạt giới hạn nhận voucher này (tối đa ${voucher.usageLimitPerUser} lần).`, 400);
      }

      // Incremental Atomic Update on Voucher
      const updatedVoucher = await Voucher.findOneAndUpdate(
        {
          _id: voucher._id,
          claimedCount: { $lt: voucher.totalQuantity },
          status: "ACTIVE",
          isDeleted: false,
        },
        { $inc: { claimedCount: 1 } },
        { new: true, session }
      );

      if (!updatedVoucher) {
        throw createServiceError("Voucher đã hết lượt nhận ngay lúc này.", 400);
      }

      // Create UserVoucher record
      const nextClaimIndex = claimCount + 1;
      const userVoucher = new UserVoucher({
        userId,
        voucherId: voucher._id,
        claimedAt: new Date(),
        isUsed: false,
        claimIndex: nextClaimIndex,
      });

      await userVoucher.save({ session });

      await logSecurityEvent({
        event: "VOUCHER_CLAIMED",
        email: user.email,
        userId: user._id,
        ip: req?.ip || req?.headers?.["x-forwarded-for"],
        userAgent: req?.headers?.["user-agent"],
        details: { voucherId: voucher._id, code: voucher.code, claimIndex: nextClaimIndex }
      });

      result = {
        message: "Nhận voucher thành công!",
        voucherCode: voucher.code,
        userVoucher,
      };
    });

    return result;
  } catch (error) {
    if (error.code === 11000) {
      throw createServiceError("Bạn đang thao tác quá nhanh hoặc đã nhận voucher này rồi.", 400);
    }
    throw error;
  } finally {
    session.endSession();
  }
};

export const getUserWallet = async (userId, filterStatus = "available") => {
  const now = new Date();
  
  // Find all user vouchers
  const userVouchers = await UserVoucher.find({ userId })
    .populate({
      path: "voucherId",
      match: { isDeleted: false },
      populate: [
        { path: "applicableProducts", select: "name price" },
        { path: "applicableCategories", select: "name" }
      ]
    })
    .sort({ claimedAt: -1 });

  // Filter out any vouchers that were hard deleted (populated as null)
  const validUserVouchers = userVouchers.filter((uv) => uv.voucherId !== null);

  return validUserVouchers.filter((uv) => {
    const v = uv.voucherId;
    const isExpired = now > v.endDate || v.status === "DISABLED";
    
    if (filterStatus === "used") {
      return uv.isUsed;
    }
    if (filterStatus === "expired") {
      return !uv.isUsed && isExpired;
    }
    // "available" status
    return !uv.isUsed && !isExpired && v.status === "ACTIVE";
  });
};

export const validateAndCalculateVoucher = async (userId, voucherCode, items = [], shippingCost = 0, deliveryOption = "delivery") => {
  const code = String(voucherCode || "").trim().toUpperCase();
  if (!code) {
    throw createServiceError("Mã voucher không được để trống.", 400);
  }

  const user = await User.findById(userId);
  if (!user || user.isBlocked) {
    throw createServiceError("Người dùng không hợp lệ hoặc đã bị khoá.", 403);
  }

  const voucher = await Voucher.findOne({ code, isDeleted: false });
  if (!voucher) {
    throw createServiceError("Mã voucher không tồn tại.", 404);
  }

  // Check general active status & expiration
  const state = voucher.lifecycleState;
  if (state === "DISABLED") {
    throw createServiceError("Voucher đã bị vô hiệu hoá.", 400);
  }
  if (state === "EXPIRED") {
    throw createServiceError("Voucher đã hết hạn sử dụng.", 400);
  }
  if (state === "SCHEDULED") {
    throw createServiceError("Voucher chưa bắt đầu thời gian áp dụng.", 400);
  }
  if (state !== "ACTIVE") {
    throw createServiceError("Voucher hiện không khả dụng.", 400);
  }

  // Check User Level
  if (voucher.applicableUserLevels && voucher.applicableUserLevels.length > 0) {
    const userLevel = user.level || "standard";
    if (!voucher.applicableUserLevels.includes(userLevel)) {
      throw createServiceError("Voucher này không áp dụng cho cấp bậc tài khoản của bạn.", 400);
    }
  }

  // Check if User owns this voucher and it's unused
  const userVoucher = await UserVoucher.findOne({
    userId,
    voucherId: voucher._id,
    isUsed: false,
  });

  if (!userVoucher) {
    throw createServiceError("Bạn không sở hữu voucher này hoặc voucher đã được sử dụng.", 400);
  }

  // Check products & categories applicability
  let applicableSubtotal = 0;
  let hasApplicableItems = false;

  // We need to fetch prices of products from DB to prevent client manipulation
  const productIds = items.map((item) => item.product_id);
  const dbProducts = await Product.find({ _id: { $in: productIds } });

  const itemsWithPrices = items.map((item) => {
    const p = dbProducts.find((p) => p._id.toString() === item.product_id.toString());
    if (!p) {
      throw createServiceError(`Sản phẩm với ID ${item.product_id} không tồn tại.`, 404);
    }
    return {
      product_id: item.product_id,
      quantity: item.quantity,
      price: p.price || 0,
      category_id: p.category_id,
    };
  });

  const totalSubtotal = itemsWithPrices.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const filterByProducts = voucher.applicableProducts && voucher.applicableProducts.length > 0;
  const filterByCategories = voucher.applicableCategories && voucher.applicableCategories.length > 0;

  if (filterByProducts || filterByCategories) {
    itemsWithPrices.forEach((item) => {
      let isProductMatch = true;
      let isCategoryMatch = true;

      if (filterByProducts) {
        isProductMatch = voucher.applicableProducts.some(
          (apId) => apId.toString() === item.product_id.toString()
        );
      }

      if (filterByCategories && item.category_id) {
        isCategoryMatch = voucher.applicableCategories.some(
          (acId) => acId.toString() === item.category_id.toString()
        );
      }

      if (isProductMatch && isCategoryMatch) {
        applicableSubtotal += item.price * item.quantity;
        hasApplicableItems = true;
      }
    });

    if (!hasApplicableItems) {
      throw createServiceError("Voucher này không áp dụng cho bất kỳ sản phẩm nào trong giỏ hàng.", 400);
    }
  } else {
    // Voucher applies to all products
    applicableSubtotal = totalSubtotal;
  }

  // Check Minimum Order Value
  if (applicableSubtotal < voucher.minOrderValue) {
    throw createServiceError(
      `Giá trị sản phẩm áp dụng chưa đạt mức tối thiểu (${voucher.minOrderValue.toLocaleString()}đ).`,
      400
    );
  }

  // Calculate Discount Amount
  let discountAmount = 0;

  if (voucher.type === "PERCENT") {
    discountAmount = (applicableSubtotal * voucher.value) / 100;
    if (voucher.maxDiscount && discountAmount > voucher.maxDiscount) {
      discountAmount = voucher.maxDiscount;
    }
  } else if (voucher.type === "FIXED") {
    discountAmount = voucher.value;
    // Discount cannot exceed the subtotal
    if (discountAmount > totalSubtotal) {
      discountAmount = totalSubtotal;
    }
  } else if (voucher.type === "FREESHIP") {
    const actualShipping = deliveryOption === "pickup" ? 0 : shippingCost;
    discountAmount = Math.min(actualShipping, voucher.value);
  }

  return {
    voucher,
    userVoucher,
    discountAmount: Math.round(discountAmount),
    applicableSubtotal,
    totalSubtotal,
  };
};
