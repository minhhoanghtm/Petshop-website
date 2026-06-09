import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Payment from "../models/Payment.js";
import { createServiceError } from "../utils/serviceError.js";
import PaymentContext from "./payment/paymentContext.js";
import CodPaymentStrategy from "./payment/codStrategy.js";
import MomoPaymentStrategy from "./payment/momoStrategy.js";
import PaypalPaymentStrategy from "./payment/paypalStrategy.js";
import VnpayPaymentStrategy from "./payment/vnpayStrategy.js";

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
    shippingCost
  } = orderData;
  
  const payment_method = orderData.payment_method || orderData.paymentMethod || "COD";
  const normalizedStatus = normalizeStatus(status) || "pending";

  const savedProducts = [];
  try {
    // 1. Trừ tồn kho nguyên tử chống Race Condition (Overselling)
    for (const item of items) {
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: item.product_id,
          stock: { $gte: item.quantity } // Đảm bảo tồn kho lớn hơn hoặc bằng số lượng mua
        },
        {
          $inc: { stock: -item.quantity } // Giảm kho nguyên tử
        },
        { new: true }
      );

      if (!updatedProduct) {
        // Tìm xem sản phẩm có tồn tại hay không để phản hồi status phù hợp
        const checkProduct = await Product.findById(item.product_id);
        if (!checkProduct) {
          throw createServiceError(`Không tìm thấy sản phẩm với ID: ${item.product_id}`, 404);
        }
        throw createServiceError(`Sản phẩm ${checkProduct.name} không đủ số lượng trong kho`, 400);
      }

      // Lưu lại thông tin sản phẩm đã trừ để có thể rollback
      savedProducts.push({ product_id: item.product_id, quantity: item.quantity });
    }

    // 2. Áp dụng Strategy Pattern để xử lý thanh toán
    let paymentStrategy;
    switch (String(payment_method).toUpperCase()) {
      case "MOMO":
        paymentStrategy = new MomoPaymentStrategy();
        break;
      case "PAYPAL":
        paymentStrategy = new PaypalPaymentStrategy();
        break;
      case "VNPAY":
        paymentStrategy = new VnpayPaymentStrategy();
        break;
      case "COD":
      default:
        paymentStrategy = new CodPaymentStrategy();
        break;
    }

    const paymentContext = new PaymentContext(paymentStrategy);
    
    // Thực thi thanh toán qua Context
    const paymentResult = await paymentContext.executePayment(total_price, { user_id, items });

    // 3. Khởi tạo và lưu đơn hàng với kết quả thanh toán tương ứng
    const newOrder = new Order({
      user_id,
      items,
      total_price,
      status: normalizedStatus,
      payment_method: payment_method.toUpperCase(),
      payment_status: paymentResult.payment_status,
      // Shipping Information
      fullName,
      email,
      phone,
      address,
      province,
      district,
      ward,
      detailAddress,
      deliveryOption: deliveryOption || "delivery",
      shippingCost: shippingCost || 0,
    });

    return await newOrder.save();
  } catch (error) {
    // Rollback lại tồn kho nguyên tử nếu xảy ra bất kỳ lỗi nào trong quá trình tạo đơn hàng
    for (const { product_id, quantity } of savedProducts) {
      try {
        await Product.updateOne(
          { _id: product_id },
          { $inc: { stock: quantity } } // Cộng lại kho nguyên tử
        );
      } catch (rollbackError) {
        console.error(`Lỗi rollback tồn kho cho sản phẩm ${product_id}:`, rollbackError);
      }
    }
    throw error;
  }
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

  if (normalizedStatus === "delivered" && previousStatus !== "delivered") {
    for (const item of currentOrder.items) {
      const product = await Product.findById(item.product_id);
      if (product) {
        product.sold = Math.max(0, Number(product.sold || 0) + Number(item.quantity || 0));
        await product.save();
      }
    }
  }

  if (normalizedStatus === "cancelled" && previousStatus !== "cancelled") {
    for (const item of currentOrder.items) {
      const product = await Product.findById(item.product_id);
      if (product) {
        product.stock = Math.max(0, Number(product.stock || 0) + Number(item.quantity || 0));
        if (previousStatus === "delivered") {
          product.sold = Math.max(0, Number(product.sold || 0) - Number(item.quantity || 0));
        }
        await product.save();
      }
    }
  }

  const updateFields = { status: normalizedStatus, updatedAt: new Date() };

  if (normalizedStatus === "cancelled" && previousStatus !== "cancelled") {
    if (currentOrder.payment_status === "paid") {
      updateFields.payment_status = "refunded";
      try {
        await Payment.updateMany({ order_id: orderId }, { status: "refunded", refunded_at: new Date() });
      } catch (paymentErr) {
        console.error("Lỗi khi cập nhật bảng Payment thành refunded:", paymentErr);
      }
    }
  }

  const updatedOrder = await Order.findByIdAndUpdate(
    orderId,
    updateFields,
    { new: true }
  )
    .populate("user_id")
    .populate("items.product_id");

  if (!updatedOrder) {
    throw createServiceError("Order not found", 404);
  }

  return updatedOrder;
};

export const deleteOrder = async (orderId) => {
  const deletedOrder = await Order.findByIdAndDelete(orderId);
  if (!deletedOrder) {
    throw createServiceError("Order not found", 404);
  }

  return { message: "Order deleted successfully" };
};

export const getOrderStats = async (timeFilter = "7days") => {
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

  return {
    totalRevenue,
    monthlyRevenue,
    weeklyRevenue,
    averageOrderValue,
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

export default {
  normalizeStatus,
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getOrderStats,
  getRecentOrders,
};
