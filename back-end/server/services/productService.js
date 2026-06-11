import mongoose from "mongoose";
import Product from "../models/Product.js";
import { getReviewSummaryByProductId } from "./reviewService.js";
import { getOrSetCache, clearProductCache } from "../utils/cacheHelper.js";
import { CACHE_TTL } from "../configs/cacheConfig.js";


// ============ Helper Functions ============

/**
 * Normalize product images
 */
const normalizeImages = (images) => {
  if (Array.isArray(images)) {
    return images.map((image) => String(image || "").trim()).filter(Boolean);
  }

  if (typeof images === "string") {
    const trimmed = images.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((image) => String(image || "").trim())
          .filter(Boolean);
      }
    } catch {
      // fall back to single string image
    }

    return [trimmed];
  }

  return [];
};

/**
 * Normalize and validate product payload
 */
const normalizeProductPayload = (payload = {}, existingProduct = null) => {
  const categoryId = payload.category_id?._id || payload.category_id || "";
  const images = normalizeImages(payload.images);
  const slugSource = String(
    payload.slug || payload.name || existingProduct?.name || "",
  ).trim();

  const normalized = {
    name: String(payload.name || existingProduct?.name || "").trim(),
    description: String(
      payload.description || existingProduct?.description || "",
    ).trim(),
    price: Number(payload.price ?? existingProduct?.price ?? 0),
    stock: Number(payload.stock ?? existingProduct?.stock ?? 0),
    category_id: String(categoryId).trim(),
    slug: slugSource
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-"),
  };

  if (images.length > 0) {
    normalized.images = images;
  } else if (existingProduct?.images?.length) {
    normalized.images = existingProduct.images;
  } else {
    normalized.images = [];
  }

  if (!normalized.slug) {
    normalized.slug = `product-${Date.now()}`;
  }

  return normalized;
};

/**
 * Validate product data
 */
const validateProduct = (productData) => {
  if (!productData.name) {
    throw new Error("Tên sản phẩm là bắt buộc");
  }
  if (!productData.description) {
    throw new Error("Mô tả sản phẩm là bắt buộc");
  }
  if (!productData.category_id) {
    throw new Error("Danh mục là bắt buộc");
  }
  if (!Number.isFinite(productData.price) || productData.price <= 0) {
    throw new Error("Giá phải lớn hơn 0");
  }
  if (!Number.isFinite(productData.stock) || productData.stock < 0) {
    throw new Error("Tồn kho không được âm");
  }
  if (!productData.images.length) {
    throw new Error("Ít nhất 1 ảnh là bắt buộc");
  }
};

const buildProductRatingLookupPipeline = () => [
  {
    $lookup: {
      from: "reviews",
      let: { productId: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$product", "$$productId"] },
                { $eq: ["$isHidden", false] },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ],
      as: "reviewSummaryAgg",
    },
  },
  {
    $addFields: {
      rating: {
        $round: [
          {
            $ifNull: [
              { $arrayElemAt: ["$reviewSummaryAgg.averageRating", 0] },
              0,
            ],
          },
          1,
        ],
      },
      numReviews: {
        $ifNull: [{ $arrayElemAt: ["$reviewSummaryAgg.totalReviews", 0] }, 0],
      },
    },
  },
  { $unset: "reviewSummaryAgg" },
];

const buildCategoryLookupPipeline = () => [
  {
    $lookup: {
      from: "categories",
      localField: "category_id",
      foreignField: "_id",
      as: "category_id",
    },
  },
  {
    $unwind: {
      path: "$category_id",
      preserveNullAndEmptyArrays: true,
    },
  },
];

const buildProductMatchQuery = (params = {}) => {
  const query = {};

  if (params.category) {
    const categoryId = String(params.category).trim();
    query.category_id = mongoose.isValidObjectId(categoryId)
      ? new mongoose.Types.ObjectId(categoryId)
      : categoryId;
  }

  return query;
};

// ============ Service Functions ============

/**
 * Get all products with optional category filter
 */
export const getAllProducts = async (params) => {
  // Tạo cache key động dựa trên tham số lọc
  const categoryFilter = params?.category || "all";
  const cacheKey = `products:list:${categoryFilter}`;
  const ttl = CACHE_TTL.PRODUCT_LIST || 300;

  return getOrSetCache(cacheKey, ttl, async () => {
    const match = buildProductMatchQuery(params);
    return Product.aggregate([
      { $match: match },
      ...buildCategoryLookupPipeline(),
      ...buildProductRatingLookupPipeline(),
    ]);
  });
};

/**
 * Get product by slug
 */
export const getProductBySlug = async (slug) => {
  const cacheKey = `products:detail:${slug}`;
  const ttl = CACHE_TTL.PRODUCT_DETAIL || 600;

  return getOrSetCache(cacheKey, ttl, async () => {
    const product = await Product.findOne({ slug })
      .populate("category_id")
      .populate({
        path: "reviews",
        populate: {
          path: "user",
          select: "fullName avatar role",
        },
        options: {
          sort: { createdAt: -1 },
        },
      });

    if (!product) {
      throw new Error("Sản phẩm không tồn tại!");
    }

    const reviewSummary = await getReviewSummaryByProductId(product._id);
    const productData = product.toObject();

    return {
      ...productData,
      rating: reviewSummary.averageRating || 0,
      numReviews: reviewSummary.totalReviews || 0,
      reviewSummary,
    };
  });
};

/**
 * Get top 20 products by sales
 */
export const getProductsSale = async () => {
  const cacheKey = "products:best_seller";
  const ttl = CACHE_TTL.BEST_SELLER || 3600;

  return getOrSetCache(cacheKey, ttl, async () => {
    return Product.aggregate([
      { $sort: { sold: -1 } },
      { $limit: 20 },
      ...buildCategoryLookupPipeline(),
      ...buildProductRatingLookupPipeline(),
    ]);
  });
};


/**
 * Create new product
 */
export const createProduct = async (productData) => {
  const normalized = normalizeProductPayload(productData);
  validateProduct(normalized);
  const product = new Product(normalized);
  const newProduct = await product.save();
  
  // Xóa cache danh sách ngay sau khi thêm mới
  await clearProductCache();
  return newProduct;
};

/**
 * Update product by ID
 */
export const updateProduct = async (productId, updateData) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error("Không tìm thấy sản phẩm!");
  }
  const oldSlug = product.slug;
  const updates = normalizeProductPayload(updateData, product);
  validateProduct(updates);
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    { $set: updates },
    { new: true, runValidators: true, context: "query" }
  );
  if (!updatedProduct) {
    throw new Error("Không tìm thấy sản phẩm!");
  }

  // Xóa cache danh sách và chi tiết của sản phẩm này (kể cả slug cũ và mới)
  await clearProductCache(oldSlug, productId);
  if (updatedProduct.slug !== oldSlug) {
    await clearProductCache(updatedProduct.slug, productId);
  }
  return updatedProduct;
};

/**
 * Delete product by ID
 */
export const deleteProduct = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error("Product not found");
  }
  const slug = product.slug;
  await Product.deleteOne({ _id: productId });
  
  // Xóa cache danh sách và chi tiết của sản phẩm vừa xóa
  await clearProductCache(slug, productId);
  return { message: "Product deleted" };
};

/**
 * Search products by name
 */
export const searchProducts = async (params) => {
  const searchQuery = params.query || params.q;

  if (!searchQuery) {
    throw new Error("Query parameter is required");
  }

  return Product.aggregate([
    {
      $match: {
        name: { $regex: String(searchQuery), $options: "i" },
      },
    },
    ...buildCategoryLookupPipeline(),
    ...buildProductRatingLookupPipeline(),
  ]);
};

/**
 * Filter products by price ranges
 */
export const filterProductsByPrice = async (params) => {
  const { priceRanges } = params;

  if (!priceRanges || !Array.isArray(priceRanges)) {
    throw new Error("Giá trị lọc không hợp lệ");
  }

  const priceQueries = priceRanges.map((range) => {
    const query = {};
    if (typeof range.min === "number") {
      query.$gte = range.min;
    }
    if (typeof range.max === "number") {
      query.$lte = range.max;
    }
    return { price: query };
  });

  const finalQuery = {
    $or: priceQueries,
  };

  return Product.aggregate([
    { $match: finalQuery },
    ...buildCategoryLookupPipeline(),
    ...buildProductRatingLookupPipeline(),
  ]);
};
