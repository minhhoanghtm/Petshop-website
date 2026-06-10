import mongoose from "mongoose";

const userVoucherSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voucher",
      required: true,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    claimIndex: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "user_vouchers",
  }
);

// Unique constraint to prevent concurrent claims exceeding limit
userVoucherSchema.index({ userId: 1, voucherId: 1, claimIndex: 1 }, { unique: true });

const UserVoucher = mongoose.model("UserVoucher", userVoucherSchema);
export default UserVoucher;
