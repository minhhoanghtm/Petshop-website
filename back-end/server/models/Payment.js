import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    payment_code: {
      type: String,
      unique: true,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    method: {
      type: String,
      required: true,
      enum: ["COD", "MOMO", "PAYPAL", "VNPAY"],
    },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    provider_transaction_id: {
      type: String,
    }, // ID giao dịch từ nhà cung cấp thanh toán (nếu có)

    provider_response: {
      type: Object,
    }, // Lưu trữ phản hồi chi tiết từ nhà cung cấp thanh toán (nếu có)

    paid_at: {
      type: Date,
    }, // Thời điểm thanh toán thành công (nếu có)

    refunded_at: {
      type: Date,
    }, // Thời điểm hoàn tiền (nếu có)
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Payment", paymentSchema);
