import Order from "../models/Order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";

const REVENUE_STATUSES = ["delivered"];

const buildStartDate = (timeFilter) => {
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

  return startDate;
};

export const getDashboardStats = async (timeFilter = "7days") => {
  const startDate = buildStartDate(timeFilter);
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
    .populate("user_id", "fullName")
    .populate("items.product_id");

  return orders.map((order) => ({
    id: order._id,
    customer: order.user_id ? order.user_id.fullName : "Unknown Customer",
    total: order.total_price,
    status: order.status,
    date: order.order_date,
  }));
};

export const getRevenueByDay = async (timeFilter = "7days") => {
  const today = new Date();
  let startDate = new Date(today);
  let categories = [];
  let revenueByDay = [];

  if (timeFilter === "7days") {
    const dayOfWeek = today.getDay();
    startDate.setDate(today.getDate() - ((dayOfWeek === 0 ? 7 : dayOfWeek) - 1));
    startDate.setHours(0, 0, 0, 0);
    categories = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    revenueByDay = Array(7).fill(0);
  } else if (timeFilter === "30days") {
    startDate.setDate(today.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);
    categories = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    });
    revenueByDay = Array(30).fill(0);
  } else if (timeFilter === "90days") {
    startDate.setDate(today.getDate() - 89);
    startDate.setHours(0, 0, 0, 0);
    categories = Array.from({ length: 90 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    });
    revenueByDay = Array(90).fill(0);
  } else if (timeFilter === "year") {
    startDate = new Date(today.getFullYear(), 0, 1);
    startDate.setHours(0, 0, 0, 0);
    categories = Array.from({ length: 12 }, (_, index) =>
      new Date(today.getFullYear(), index, 1).toLocaleDateString("vi-VN", { month: "long" })
    );
    revenueByDay = Array(12).fill(0);
  } else if (timeFilter === "all") {
    const firstOrder = await Order.findOne().sort({ order_date: 1 });
    if (!firstOrder) {
      return { categories: [], data: [] };
    }

    startDate = new Date(firstOrder.order_date);
    startDate.setHours(0, 0, 0, 0);
    const yearsDiff = today.getFullYear() - startDate.getFullYear() + 1;
    categories = Array.from({ length: yearsDiff }, (_, index) => String(startDate.getFullYear() + index));
    revenueByDay = Array(yearsDiff).fill(0);
  }

  const orders = await Order.find({
    order_date: { $gte: startDate, $lte: today },
    status: { $in: REVENUE_STATUSES },
  }).select("order_date total_price");

  orders.forEach((order) => {
    const orderDate = new Date(order.order_date);
    let index;

    if (timeFilter === "7days") {
      const orderDay = orderDate.getDay();
      index = orderDay === 0 ? 6 : orderDay - 1;
    } else if (timeFilter === "30days" || timeFilter === "90days") {
      index = Math.floor((orderDate - startDate) / (1000 * 60 * 60 * 24));
    } else if (timeFilter === "year") {
      index = orderDate.getMonth();
    } else if (timeFilter === "all") {
      index = orderDate.getFullYear() - startDate.getFullYear();
    }

    if (index >= 0 && index < revenueByDay.length) {
      revenueByDay[index] += Number(order.total_price || 0);
    }
  });

  return { categories, data: revenueByDay };
};

export const getRevenueByCategory = async () => {
  const rawStats = await Order.aggregate([
    { $match: { status: { $in: REVENUE_STATUSES } } },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.product_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "categories",
        localField: "product.category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    {
      $group: {
        _id: "$category.name",
        revenue: { $sum: { $multiply: ["$items.quantity", "$product.price"] } },
      },
    },
  ]);

  const totalRevenue = rawStats.reduce((sum, item) => sum + item.revenue, 0);

  const labels = rawStats.map((item) => item._id);
  const data = rawStats.map((item) =>
    totalRevenue > 0 ? Number(((item.revenue / totalRevenue) * 100).toFixed(1)) : 0
  );

  if (labels.length > 5) {
    const combined = labels
      .map((label, index) => ({ label, value: data[index] }))
      .sort((a, b) => b.value - a.value);

    const topCategories = combined.slice(0, 4);
    const otherCategories = combined.slice(4);
    const otherValue = otherCategories.reduce((sum, category) => sum + category.value, 0);

    const newLabels = topCategories.map((category) => category.label);
    const newData = topCategories.map((category) => category.value);

    newLabels.push("Khác");
    newData.push(Number(otherValue.toFixed(1)));

    return { labels: newLabels, data: newData };
  }

  return { labels, data };
};

export const getDashboardNotifications = async () => {
  const lowStockThreshold = 10;

  const lowStockProducts = await Product.find({ stock: { $lte: lowStockThreshold } }).limit(3);
  const pendingOrders = await Order.find({ status: "pending" }).sort({ order_date: -1 }).limit(3);
  const recentUsers = await User.find().sort({ _id: -1 }).limit(3);

  const notifications = [];

  lowStockProducts.forEach((product) => {
    notifications.push({
      type: "stock",
      message: `Sản phẩm "${product.name}" sắp hết hàng (còn ${product.stock} sản phẩm)`,
      date: new Date(),
    });
  });

  pendingOrders.forEach((order) => {
    notifications.push({
      type: "order",
      message: `Đơn hàng mới #${order._id} đang chờ xử lý`,
      date: order.order_date,
    });
  });

  recentUsers.forEach((user) => {
    notifications.push({
      type: "user",
      message: `Người dùng mới ${user.fullName} vừa đăng ký`,
      date: user._id.getTimestamp(),
    });
  });

  notifications.sort((a, b) => new Date(b.date) - new Date(a.date));
  return notifications.slice(0, 5);
};

export const importOrdersFromCSV = async () => {
  return { message: "Orders imported successfully" };
};

export default {
  getDashboardStats,
  getRecentOrders,
  getRevenueByDay,
  getRevenueByCategory,
  getDashboardNotifications,
  importOrdersFromCSV,
};
