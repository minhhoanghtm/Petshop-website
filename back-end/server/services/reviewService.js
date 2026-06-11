import mongoose from "mongoose";
import Review from "../models/Review.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { createServiceError } from "../utils/serviceError.js";
import { logger } from "../logger/logger.js";
import { clearProductCache } from "../utils/cacheHelper.js";

const normalizeImages = (images) => {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .filter((image) => typeof image === "string" && image.trim())
    .slice(0, 5);
};

const buildEmptySummary = () => ({
  averageRating: 0,
  totalReviews: 0,
  ratingBreakdown: {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  },
});

const REVIEWABLE_ORDER_STATUSES = [
  "delivered",
  "completed",
  "đã giao hàng",
  "đã giao hàng thành công",
  "hoàn tất",
];

const normalizeStatus = (value) => {
  if (!value) return "";
  return String(value).trim().toLowerCase();
};

const isReviewableStatus = (value) => REVIEWABLE_ORDER_STATUSES.includes(normalizeStatus(value));

const normalizeObjectId = (value) => (mongoose.isValidObjectId(value) ? String(value) : null);

const buildReviewPopulation = () => [
  { path: "user", select: "fullName avatar role" },
  { path: "product", select: "name slug images price" },
  { path: "orderId", select: "status order_date total_price items" },
];

const populateReview = (query) => query.populate(buildReviewPopulation());

const orderHasProduct = (order, productId) => {
  const targetId = String(productId);
  return Array.isArray(order?.items) && order.items.some((item) => {
    const itemProductId = item?.product_id?._id || item?.product_id;
    return String(itemProductId) === targetId;
  });
};

const findEligibleOrderForProduct = async ({ userId, productId, orderId = null }) => {
  const purchaseQuery = {
    user_id: userId,
    status: { $in: REVIEWABLE_ORDER_STATUSES },
    "items.product_id": productId,
  };

  if (orderId) {
    const exactOrder = await Order.findById(orderId)
      .populate("user_id", "fullName avatar role")
      .populate("items.product_id", "name slug images price");

    if (!exactOrder) return null;

    if (String(exactOrder.user_id?._id || exactOrder.user_id) !== String(userId)) {
      return null;
    }

    if (!isReviewableStatus(exactOrder.status) || !orderHasProduct(exactOrder, productId)) {
      return null;
    }

    return exactOrder;
  }

  return Order.findOne(purchaseQuery)
    .sort({ order_date: -1 })
    .populate("user_id", "fullName avatar role")
    .populate("items.product_id", "name slug images price");
};

const getUserReviewMap = async (userId) => {
  const reviews = await Review.find({ user: userId })
    .populate(buildReviewPopulation())
    .sort({ createdAt: -1 });

  const reviewMap = new Map();
  reviews.forEach((review) => {
    const productId = String(review.product?._id || review.product);
    if (!reviewMap.has(productId)) {
      reviewMap.set(productId, review);
    }
  });

  return { reviews, reviewMap };
};

const buildCanReviewResponse = ({ order, review }) => {
  if (!order) {
    return {
      canReview: false,
      purchased: false,
      reviewed: Boolean(review),
      orderId: null,
      review: review || null,
      message: "Bạn cần mua sản phẩm và nhận hàng thành công trước khi đánh giá",
    };
  }

  return {
    canReview: !review,
    purchased: true,
    reviewed: Boolean(review),
    orderId: order._id,
    review: review || null,
    order,
    message: review
      ? "Sản phẩm này đã được bạn đánh giá. Bạn có thể chỉnh sửa review."
      : "Bạn có thể đánh giá sản phẩm này.",
  };
};

export const getReviewSummaryByProductId = async (productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    return buildEmptySummary();
  }

  const summary = await Review.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        isHidden: false,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
        ratingCounts: { $push: "$rating" },
      },
    },
  ]);

  if (!summary.length) {
    return buildEmptySummary();
  }

  const ratingBreakdown = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };

  summary[0].ratingCounts.forEach((rating) => {
    const normalizedRating = Math.round(Number(rating));
    if (ratingBreakdown[normalizedRating] !== undefined) {
      ratingBreakdown[normalizedRating] += 1;
    }
  });

  return {
    averageRating: Number((summary[0].averageRating || 0).toFixed(1)),
    totalReviews: summary[0].totalReviews || 0,
    ratingBreakdown,
  };
};

const updateProductReviewStats = async (productId) => {
  try {
    if (!mongoose.isValidObjectId(productId)) return null;

    const summary = await getReviewSummaryByProductId(productId);

    await Product.findByIdAndUpdate(
      productId,
      {
        rating: summary.averageRating || 0,
        numReviews: summary.totalReviews || 0,
      },
      { new: true }
    );

    // Xóa cache chi tiết và danh sách sản phẩm để cập nhật ratings/reviews ngay lập tức
    const product = await Product.findById(productId).select("slug");
    if (product && product.slug) {
      await clearProductCache(product.slug);
    }

    return summary;
  } catch (error) {
    logger.error("updateProductReviewStats error", { message: error.message, stack: error.stack });
    return null;
  }
};

export const canReviewProduct = async (user, productIdParam) => {
  if (!user?._id) {
    throw createServiceError("Bạn cần đăng nhập để tiếp tục.", 401);
  }

  const productId = normalizeObjectId(productIdParam);
  if (!productId) {
    throw createServiceError("Sản phẩm không hợp lệ.", 400);
  }

  const order = await findEligibleOrderForProduct({
    userId: user._id,
    productId,
  });

  const review = await Review.findOne({
    user: user._id,
    product: productId,
    isHidden: false,
  }).populate(buildReviewPopulation());

  return buildCanReviewResponse({ order, review });
};

export const checkOrderReview = async (user, payload = {}) => {
  const parsedProductId = normalizeObjectId(payload.productId);
  const parsedOrderId = normalizeObjectId(payload.orderId);

  if (!parsedProductId || !parsedOrderId) {
    throw createServiceError("Thiếu thông tin đơn hàng hoặc sản phẩm.", 400);
  }

  const order = await findEligibleOrderForProduct({
    userId: user._id,
    productId: parsedProductId,
    orderId: parsedOrderId,
  });

  if (!order) {
    return {
      canReview: false,
      purchased: false,
      message: "Bạn cần mua sản phẩm và nhận hàng thành công trước khi đánh giá",
    };
  }

  const review = await Review.findOne({
    user: user._id,
    product: parsedProductId,
    orderId: parsedOrderId,
    isHidden: false,
  }).populate(buildReviewPopulation());

  return buildCanReviewResponse({ order, review });
};

export const getMyPurchasedProducts = async (user) => {
  if (!user?._id) {
    throw createServiceError("Bạn cần đăng nhập để tiếp tục.", 401);
  }

  const orders = await Order.find({
    user_id: user._id,
    status: { $in: REVIEWABLE_ORDER_STATUSES },
  })
    .populate("user_id", "fullName avatar role")
    .populate("items.product_id", "name slug images price");

  const { reviewMap } = await getUserReviewMap(user._id);
  const productMap = new Map();

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const product = item.product_id;
      if (!product?._id) return;

      const productKey = String(product._id);
      const review = reviewMap.get(productKey) || null;

      const currentItem = productMap.get(productKey);
      const payload = {
        product,
        orderId: order._id,
        orderDate: order.order_date,
        orderStatus: order.status,
        orderStatusNormalized: normalizeStatus(order.status),
        quantity: item.quantity,
        reviewed: Boolean(review),
        review,
        canReview: isReviewableStatus(order.status) && !review,
        isVerifiedPurchase: true,
      };

      if (!currentItem || new Date(order.order_date) > new Date(currentItem.orderDate)) {
        productMap.set(productKey, payload);
      }
    });
  });

  return Array.from(productMap.values());
};

export const getMyReviews = async (user) => {
  if (!user?._id) {
    throw createServiceError("Bạn cần đăng nhập để tiếp tục.", 401);
  }

  const { reviews } = await getUserReviewMap(user._id);
  const summaryByProduct = await Promise.all(
    reviews.map(async (review) => ({
      review,
      summary: await getReviewSummaryByProductId(review.product?._id || review.product),
    }))
  );

  return summaryByProduct.map(({ review, summary }) => ({
    ...review.toObject(),
    summary,
  }));
};

export const createReview = async (user, reviewData = {}) => {
  if (!user?._id) {
    throw createServiceError("Bạn cần đăng nhập để tiếp tục.", 401);
  }

  const { productId, orderId, rating, comment, images = [] } = reviewData;
  const parsedProductId = normalizeObjectId(productId);
  const parsedOrderId = normalizeObjectId(orderId);

  if (!parsedProductId) {
    throw createServiceError("Sản phẩm không hợp lệ.", 400);
  }

  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw createServiceError("Số sao phải từ 1 đến 5.", 400);
  }

  const trimmedComment = String(comment || "").trim();
  if (!trimmedComment) {
    throw createServiceError("Vui lòng nhập nội dung đánh giá.", 400);
  }

  const product = await Product.findById(parsedProductId);
  if (!product) {
    throw createServiceError("Sản phẩm không tồn tại.", 404);
  }

  const eligibleOrder = await findEligibleOrderForProduct({
    userId: user._id,
    productId: parsedProductId,
    orderId: parsedOrderId,
  });

  if (!eligibleOrder) {
    throw createServiceError(
      "Bạn cần mua sản phẩm và nhận hàng thành công trước khi đánh giá",
      403
    );
  }

  const existingReview = await Review.findOne({
    user: user._id,
    product: parsedProductId,
  });

  if (existingReview) {
    throw createServiceError(
      "Bạn đã đánh giá sản phẩm này rồi. Vui lòng chỉnh sửa review hiện có.",
      409,
      { review: existingReview }
    );
  }

  const review = await Review.create({
    user: user._id,
    product: parsedProductId,
    orderId: eligibleOrder._id,
    rating: numericRating,
    comment: trimmedComment,
    images: normalizeImages(images),
    isVerifiedPurchase: true,
  });

  const populatedReview = await populateReview(Review.findById(review._id));
  const summary = await getReviewSummaryByProductId(parsedProductId);
  await updateProductReviewStats(parsedProductId);

  return {
    message: "Đã gửi đánh giá thành công.",
    review: populatedReview,
    summary,
  };
};

export const getReviewsByProduct = async (productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw createServiceError("Sản phẩm không hợp lệ.", 400);
  }

  const product = await Product.findById(productId).select("_id");
  if (!product) {
    throw createServiceError("Sản phẩm không tồn tại.", 404);
  }

  const reviews = await Review.find({
    product: productId,
    isHidden: false,
  })
    .populate(buildReviewPopulation())
    .sort({ createdAt: -1 });

  const summary = await getReviewSummaryByProductId(productId);
  return { reviews, ...summary };
};

export const deleteReview = async (user, reviewId) => {
  if (!mongoose.isValidObjectId(reviewId)) {
    throw createServiceError("Đánh giá không hợp lệ.", 400);
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    throw createServiceError("Đánh giá không tồn tại.", 404);
  }

  const isOwner = String(review.user) === String(user?._id);
  const isAdmin = user?.role === "admin";

  if (!isOwner && !isAdmin) {
    throw createServiceError("Bạn không có quyền xóa đánh giá này.", 403);
  }

  await Review.deleteOne({ _id: reviewId });

  const summary = await getReviewSummaryByProductId(review.product);
  await updateProductReviewStats(review.product);

  return {
    message: "Đã xóa đánh giá.",
    reviewId,
    summary,
  };
};

export const hideReview = async (reviewId) => {
  if (!mongoose.isValidObjectId(reviewId)) {
    throw createServiceError("Đánh giá không hợp lệ.", 400);
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    throw createServiceError("Đánh giá không tồn tại.", 404);
  }

  review.isHidden = true;
  await review.save();

  const summary = await getReviewSummaryByProductId(review.product);
  await updateProductReviewStats(review.product);

  return {
    message: "Đã ẩn đánh giá.",
    reviewId,
    summary,
  };
};

export const updateReview = async (user, reviewId, reviewData = {}) => {
  if (!mongoose.isValidObjectId(reviewId)) {
    throw createServiceError("Đánh giá không hợp lệ.", 400);
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    throw createServiceError("Đánh giá không tồn tại.", 404);
  }

  const isOwner = String(review.user) === String(user?._id);
  const isAdmin = user?.role === "admin";

  if (!isOwner && !isAdmin) {
    throw createServiceError("Bạn không có quyền chỉnh sửa review này.", 403);
  }

  const nextProductId = normalizeObjectId(reviewData.productId) || String(review.product);
  const nextOrderId = normalizeObjectId(reviewData.orderId) || String(review.orderId);
  const numericRating = Number(reviewData.rating);

  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw createServiceError("Số sao phải từ 1 đến 5.", 400);
  }

  const trimmedComment = String(reviewData.comment || "").trim();
  if (!trimmedComment) {
    throw createServiceError("Vui lòng nhập nội dung đánh giá.", 400);
  }

  const eligibleOrder = await findEligibleOrderForProduct({
    userId: review.user,
    productId: nextProductId,
    orderId: nextOrderId,
  });

  if (!eligibleOrder) {
    throw createServiceError(
      "Bạn cần mua sản phẩm và nhận hàng thành công trước khi đánh giá",
      403
    );
  }

  review.product = nextProductId;
  review.orderId = eligibleOrder._id;
  review.rating = numericRating;
  review.comment = trimmedComment;
  review.images = normalizeImages(reviewData.images || []);
  review.isVerifiedPurchase = true;

  await review.save();

  const populatedReview = await populateReview(Review.findById(review._id));
  const summary = await getReviewSummaryByProductId(nextProductId);
  await updateProductReviewStats(nextProductId);

  return {
    message: "Đã cập nhật đánh giá.",
    review: populatedReview,
    summary,
  };
};

export default {
  getReviewSummaryByProductId,
  canReviewProduct,
  checkOrderReview,
  getMyPurchasedProducts,
  getMyReviews,
  createReview,
  getReviewsByProduct,
  deleteReview,
  hideReview,
  updateReview,
};