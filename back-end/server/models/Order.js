import mongoose from "mongoose";

const normalizeStatus = (value) => {
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

const orderSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        product_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
      },
    ],
    total_price: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "confirmed", "shipping", "delivered", "cancelled"],
      set: normalizeStatus,
    },
    payment_method: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: "COD",
      enum: ["COD", "MOMO", "PAYPAL", "VNPAY"],
    },
    payment_status: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "paid", "failed", "refunded"],
    },
    // Shipping Information
    fullName: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: false,
    },
    phone: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: false,
    },
    province: {
      type: String,
      required: false,
    },
    district: {
      type: String,
      required: false,
    },
    ward: {
      type: String,
      required: false,
    },
    detailAddress: {
      type: String,
      required: false,
    },
    deliveryOption: {
      type: String,
      enum: ["delivery", "pickup"],
      default: "delivery",
    },
    shippingCost: {
      type: Number,
      default: 0,
    },
    order_date: {
      type: Date,
      default: Date.now,
    },
    lastEventSequence: {
      type: Number,
      required: false,
    },
    voucher_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voucher",
      default: null,
    },
    discount_amount: {
      type: Number,
      default: 0,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "orders" },
);

orderSchema.index({ status: 1, order_date: -1 });
orderSchema.index({ user_id: 1, order_date: -1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;
