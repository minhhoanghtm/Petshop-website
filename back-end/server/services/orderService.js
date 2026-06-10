import mongoose from "mongoose";
import redisClient from "../configs/redisClient.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Payment from "../models/Payment.js";
import EventStore from "../models/EventStore.js";
import { getNextGlobalSequence } from "../services/sequenceGenerator.js";
import { enqueueEventForProjection } from "../queues/projectionQueue.js";
import { enqueueOrderExpiry } from "../queues/orderExpiryQueue.js";
import { logger } from "../logger/logger.js";
import { createServiceError } from "../utils/serviceError.js";
import PaymentContext from "./payment/paymentContext.js";
import CodPaymentStrategy from "./payment/codStrategy.js";
import MomoPaymentStrategy from "./payment/momoStrategy.js";
import PaypalPaymentStrategy from "./payment/paypalStrategy.js";
import VnpayPaymentStrategy from "./payment/vnpayStrategy.js";
import Voucher from "../models/Voucher.js";
import UserVoucher from "../models/UserVoucher.js";
import { validateAndCalculateVoucher } from "./voucherService.js";

const REVENUE_STATUSES = ["delivered"];

export const normalizeStatus = (value) => {
  if (!value) return value;
  const normalized = String(value).trim();

  switch (normalized) {
    case "pending":
    case "Chờ xử lý":
    case "Chờ xác nhận":
      return "pending";
    case "confirmed":
    case "Đang xử lý":
    case "Đã xác nhận":
      return "confirmed";
    case "shipping":
    case "Đang giao hàng":
    case "Đang giao":
      return "shipping";
    case "delivered":
    case "Đã giao hàng":
    case "Đã giao":
    case "Hoàn tất":
      return "delivered";
    case "cancelled":
    case "Đã hủy":
      return "cancelled";
    default:
      return normalized;
  }
};

const reserveStockInRedis = async (items) => {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error("Redis is not open");
  }
  const reserved = [];
  for (const item of items) {
    const key = `stock:product:${item.product_id}`;
    const currentStock = await redisClient.get(key);
    if (currentStock === null) {
      const dbProduct = await Product.findById(item.product_id);
      if (!dbProduct) throw new Error(`Product not found: ${item.product_id}`);
      await redisClient.set(key, dbProduct.stock);
    }
    const val = await redisClient.decrBy(key, item.quantity);
    if (val < 0) {
      await redisClient.incrBy(key, item.quantity);
      for (const res of reserved) {
        await redisClient.incrBy(`stock:product:${res.product_id}`, res.quantity);
      }
      return false;
    }
    reserved.push(item);
  }
  return true;
};

const getProductStock = async (product, session) => {
  const pendingEvents = await EventStore.find({
    aggregateId: product._id.toString(),
    globalSequence: { $gt: product.lastEventSequence || 0 }
  }).session(session);

  let stock = product.stock;
  for (const event of pendingEvents) {
    if (event.eventType === "StockReserved") {
      stock -= event.payload.quantity;
    } else if (event.eventType === "StockReleased") {
      const hasPayment = await EventStore.findOne({
        aggregateId: event.payload.orderId,
        eventType: "PaymentReceived"
      }).session(session);
      if (!hasPayment) {
        stock += event.payload.quantity;
      }
    }
  }
  return stock;
};

export const createOrder = async (orderData = {}) => {
  const { 
    user_id, 
    items, 
    total_price,
    status,
    fullName,
    email,
    phone,
    address,
    province,
    district,
    ward,
    detailAddress,
    deliveryOption,
    shippingCost,
    voucherCode,
    voucherId,
  } = orderData;
  
  const payment_method = orderData.payment_method || orderData.paymentMethod || "COD";
  const correlationId = `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // 1. Redis stock pre-gating with MongoDB fallback
  let usedRedisPreGate = false;
  try {
    const reserved = await reserveStockInRedis(items);
    if (!reserved) {
      throw createServiceError("Sản phẩm không đủ số lượng trong kho", 400);
    }
    usedRedisPreGate = true;
  } catch (redisError) {
    logger.warn("Redis pre-gating unavailable, falling back to MongoDB real-time validation", {
      message: redisError.message,
    });
  }

  const session = await mongoose.startSession();
  let newEvents = [];
  const orderId = new mongoose.Types.ObjectId().toString();
  let voucherPayload = {};
  let finalTotalPrice = total_price;

  try {
    await session.withTransaction(async () => {
      newEvents = [];
      
      // If Redis was not used, validate stock using DB event log + read model
      if (!usedRedisPreGate) {
        for (const item of items) {
          const product = await Product.findById(item.product_id).session(session);
          if (!product) {
            throw createServiceError(`Sản phẩm với ID ${item.product_id} không tồn tại`, 404);
          }
          const realTimeStock = await getProductStock(product, session);
          if (realTimeStock < item.quantity) {
            throw createServiceError(`Sản phẩm ${product.name} không đủ số lượng trong kho`, 400);
          }
        }
      }

      // Handle Voucher application atomically
      if (voucherId || voucherCode) {
        const query = voucherId
          ? { _id: voucherId, isDeleted: false }
          : { code: String(voucherCode).trim().toUpperCase(), isDeleted: false };
        
        const voucher = await Voucher.findOne(query).session(session);
        if (!voucher) {
          throw createServiceError("Voucher không tồn tại hoặc đã bị xoá.", 404);
        }

        // Validate voucher and calculate discount
        const calculation = await validateAndCalculateVoucher(user_id, voucher.code, items, shippingCost, deliveryOption);

        // Atomic update UserVoucher isUsed
        const updatedUserVoucher = await UserVoucher.findOneAndUpdate(
          { _id: calculation.userVoucher._id, isUsed: false },
          { $set: { isUsed: true, usedAt: new Date(), orderId } },
          { new: true, session }
        );

        if (!updatedUserVoucher) {
          throw createServiceError("Voucher đã được sử dụng ở giao dịch khác.", 400);
        }

        // Atomic update Voucher usedCount
        await Voucher.findOneAndUpdate(
          { _id: voucher._id, isDeleted: false },
          { $inc: { usedCount: 1 } },
          { new: true, session }
        );

        voucherPayload = {
          voucher_id: voucher._id.toString(),
          discount_amount: calculation.discountAmount,
          voucher_code: voucher.code,
          voucher_snapshot: {
            voucherCode: voucher.code,
            voucherType: voucher.type,
            voucherValue: voucher.value,
          },
        };

        const expectedTotal = calculation.totalSubtotal + (deliveryOption === "pickup" ? 0 : shippingCost) - calculation.discountAmount;
        finalTotalPrice = Math.max(0, expectedTotal);
      }

      // Generate events
      // Event 1: OrderPlaced
      const seqOrderPlaced = await getNextGlobalSequence();
      const orderPlacedEvent = new EventStore({
        aggregateId: orderId,
        aggregateType: "Order",
        version: 1,
        eventType: "OrderPlaced",
        globalSequence: seqOrderPlaced,
        correlationId,
        causationId: correlationId,
        payload: {
          user_id,
          items,
          total_price: finalTotalPrice,
          payment_method,
          fullName,
          email,
          phone,
          address,
          province,
          district,
          ward,
          detailAddress,
          deliveryOption: deliveryOption || "delivery",
          shippingCost: deliveryOption === "pickup" ? 0 : shippingCost,
          orderId,
          ...voucherPayload,
        },
      });
      await orderPlacedEvent.save({ session });
      newEvents.push(orderPlacedEvent);

      // Event 2: StockReserved for each item
      for (const item of items) {
        const latestProductEvent = await EventStore.findOne({ aggregateId: item.product_id })
          .sort({ version: -1 })
          .session(session);
        const nextProductVersion = latestProductEvent ? latestProductEvent.version + 1 : 1;

        const seqStockReserved = await getNextGlobalSequence();
        const stockReservedEvent = new EventStore({
          aggregateId: item.product_id,
          aggregateType: "Product",
          version: nextProductVersion,
          eventType: "StockReserved",
          globalSequence: seqStockReserved,
          correlationId,
          causationId: orderPlacedEvent._id.toString(),
          payload: { productId: item.product_id, quantity: item.quantity, orderId },
        });
        await stockReservedEvent.save({ session });
        newEvents.push(stockReservedEvent);
      }
    });
  } catch (error) {
    if (usedRedisPreGate) {
      try {
        for (const item of items) {
          await redisClient.incrBy(`stock:product:${item.product_id}`, item.quantity);
        }
      } catch (redisRollbackErr) {
        logger.error("Failed to rollback Redis stock on transaction failure", redisRollbackErr);
      }
    }
    throw error;
  } finally {
    session.endSession();
  }

  // Dispatch events asynchronously to Projection Queue
  for (const event of newEvents) {
    await enqueueEventForProjection(event);
  }

  // Schedule order expiration (15 minutes) if payment method is online
  if (["MOMO", "PAYPAL", "VNPAY"].includes(payment_method.toUpperCase())) {
    await enqueueOrderExpiry(orderId, 15 * 60 * 1000);
  }

  return {
    _id: orderId,
    user_id,
    items,
    total_price: finalTotalPrice,
    status: "pending",
    payment_status: "pending",
    payment_method,
    order_date: new Date(),
    voucher_id: voucherPayload.voucher_id || null,
    discount_amount: voucherPayload.discount_amount || 0,
  };
};

export const getOrders = async (queryParams = {}, currentUser = null, pagination = null) => {
  const { user_id } = queryParams;
  const query = {};

  if (currentUser?.role !== "admin") {
    if (user_id && user_id !== currentUser?._id?.toString()) {
      throw createServiceError("Bạn chỉ được xem đơn hàng của chính mình", 403);
    }

    query.user_id = currentUser?._id;
  } else if (user_id) {
    query.user_id = user_id;
  }

  if (pagination) {
    const { limit, skip, page } = pagination;
    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort({ order_date: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user_id")
      .populate("items.product_id");

    return {
      orders,
      total,
      currentPage: page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  return Order.find(query).populate("user_id").populate("items.product_id");
};

export const getOrderById = async (orderId, currentUser = null) => {
  const order = await Order.findById(orderId)
    .populate("user_id")
    .populate("items.product_id");

  if (!order) {
    throw createServiceError("Order not found", 404);
  }

  if (currentUser?.role !== "admin" && order.user_id?._id?.toString() !== currentUser?._id?.toString()) {
    throw createServiceError("Bạn không có quyền xem đơn hàng này", 403);
  }

  return order;
};

export const updateOrder = async (orderId, updateData = {}, currentUser = null) => {
  const { status } = updateData;
  const normalizedStatus = normalizeStatus(status);

  if (!normalizedStatus) {
    throw createServiceError("Trạng thái không hợp lệ.", 400);
  }

  const currentOrder = await Order.findById(orderId);
  if (!currentOrder) {
    throw createServiceError("Order not found", 404);
  }

  const previousStatus = normalizeStatus(currentOrder.status);
  const correlationId = `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const isAdmin = currentUser?.role === "admin";
  if (!isAdmin) {
    const currentStatus = normalizeStatus(currentOrder.status);

    if (normalizedStatus !== "cancelled") {
      throw createServiceError("Bạn không có quyền cập nhật trạng thái đơn hàng.", 403);
    }

    if (currentOrder.user_id?.toString() !== currentUser?._id?.toString()) {
      throw createServiceError("Bạn chỉ được huỷ đơn hàng của chính mình.", 403);
    }

    if (!["pending", "confirmed"].includes(currentStatus)) {
      throw createServiceError("Không thể huỷ đơn hàng ở trạng thái hiện tại.", 400);
    }
  }

  if (normalizedStatus === previousStatus) {
    return currentOrder;
  }

  const session = await mongoose.startSession();
  let newEvents = [];

  try {
    await session.withTransaction(async () => {
      newEvents = [];

      const latestOrderEvent = await EventStore.findOne({ aggregateId: orderId })
        .sort({ version: -1 })
        .session(session);
      const nextOrderVersion = latestOrderEvent ? latestOrderEvent.version + 1 : 1;

      let eventType = "OrderStatusChanged";
      if (normalizedStatus === "cancelled") {
        eventType = "OrderCancelled";
      } else if (normalizedStatus === "delivered") {
        eventType = "OrderDelivered";
      }

      const seqOrderEvent = await getNextGlobalSequence();
      const statusEvent = new EventStore({
        aggregateId: orderId,
        aggregateType: "Order",
        version: nextOrderVersion,
        eventType,
        globalSequence: seqOrderEvent,
        correlationId,
        causationId: correlationId,
        payload: { orderId, previousStatus, newStatus: normalizedStatus },
      });
      await statusEvent.save({ session });
      newEvents.push(statusEvent);

      if (normalizedStatus === "cancelled" && previousStatus !== "cancelled") {
        for (const item of currentOrder.items) {
          const latestProductEvent = await EventStore.findOne({ aggregateId: item.product_id.toString() })
            .sort({ version: -1 })
            .session(session);
          const nextProductVersion = latestProductEvent ? latestProductEvent.version + 1 : 1;

          const seqStockReleased = await getNextGlobalSequence();
          const stockReleasedEvent = new EventStore({
            aggregateId: item.product_id.toString(),
            aggregateType: "Product",
            version: nextProductVersion,
            eventType: "StockReleased",
            globalSequence: seqStockReleased,
            correlationId,
            causationId: statusEvent._id.toString(),
            payload: { productId: item.product_id.toString(), quantity: item.quantity, orderId },
          });
          await stockReleasedEvent.save({ session });
          newEvents.push(stockReleasedEvent);
        }

        // Voucher Restore Policy on Cancellation
        if (currentOrder.voucher_id) {
          const voucher = await Voucher.findById(currentOrder.voucher_id).session(session);
          if (voucher && voucher.restoreVoucherOnCancel) {
            const minutesLimit = voucher.restoreOnlyIfCancelledWithinMinutes || 30;
            const orderCreatedAt = currentOrder.order_date || currentOrder.createdAt;
            const diffMs = Date.now() - new Date(orderCreatedAt).getTime();
            const diffMins = diffMs / (60 * 1000);

            if (diffMins <= minutesLimit) {
              // Re-enable UserVoucher record
              await UserVoucher.updateOne(
                { orderId: currentOrder._id, isUsed: true },
                { $set: { isUsed: false, usedAt: null, orderId: null } }
              ).session(session);

              // Decrement Voucher usedCount
              await Voucher.updateOne(
                { _id: voucher._id },
                { $inc: { usedCount: -1 } }
              ).session(session);

              logger.info(`Voucher ${voucher.code} restored for user ${currentOrder.user_id} (cancellation within ${minutesLimit} mins limit).`);
            } else {
              logger.info(`Voucher ${voucher.code} NOT restored. Cancelled after ${minutesLimit} mins limit (Actual: ${Math.round(diffMins)} mins).`);
            }
          }
        }
      }
    });
  } finally {
    session.endSession();
  }

  for (const event of newEvents) {
    await enqueueEventForProjection(event);
  }

  const populatedOrder = await Order.findById(orderId)
    .populate("user_id")
    .populate("items.product_id");

  return {
    ...(populatedOrder || currentOrder).toObject(),
    status: normalizedStatus,
    updatedAt: new Date(),
  };
};

export const deleteOrder = async (orderId) => {
  const deletedOrder = await Order.findByIdAndDelete(orderId);
  if (!deletedOrder) {
    throw createServiceError("Order not found", 404);
  }

  return { message: "Order deleted successfully" };
};

export const getOrderStats = async (timeFilter = "all") => {
  let startDate = new Date();

  switch (timeFilter) {
    case "7days":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "30days":
      startDate.setDate(startDate.getDate() - 30);
      break;
    case "90days":
      startDate.setDate(startDate.getDate() - 90);
      break;
    case "year":
      startDate = new Date(startDate.getFullYear(), 0, 1);
      break;
    case "all":
      startDate = new Date(2000, 0, 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }

  const orders = await Order.find({
    order_date: { $gte: startDate },
    status: { $in: REVENUE_STATUSES },
  }).select("total_price");

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);

  const monthlyStartDate = new Date();
  monthlyStartDate.setDate(monthlyStartDate.getDate() - 30);
  const monthlyRevenue = await Order.aggregate([
    {
      $match: {
        order_date: { $gte: monthlyStartDate },
        status: { $in: REVENUE_STATUSES },
      },
    },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$total_price", 0] } } } },
  ]).then((rows) => Number(rows?.[0]?.total || 0));

  const weeklyStartDate = new Date();
  weeklyStartDate.setDate(weeklyStartDate.getDate() - 7);
  const weeklyRevenue = await Order.aggregate([
    {
      $match: {
        order_date: { $gte: weeklyStartDate },
        status: { $in: REVENUE_STATUSES },
      },
    },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$total_price", 0] } } } },
  ]).then((rows) => Number(rows?.[0]?.total || 0));

  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
  const totalOrders = await Order.countDocuments({
    order_date: { $gte: startDate },
  });

  return {
    totalRevenue,
    monthlyRevenue,
    weeklyRevenue,
    averageOrderValue,
    totalOrders,
  };
};

export const getRecentOrders = async (limit = 5) => {
  const orders = await Order.find()
    .sort({ order_date: -1 })
    .limit(Number.parseInt(limit, 10))
    .populate("user_id", "fullName");

  return orders.map((order) => ({
    id: order._id,
    customer: order.user_id ? order.user_id.fullName : "Unknown Customer",
    total: order.total_price,
    status: order.status,
    date: order.order_date,
  }));
};

