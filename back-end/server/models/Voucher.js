import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên voucher là bắt buộc."],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Mã voucher là bắt buộc."],
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Loại voucher là bắt buộc."],
      enum: ["PERCENT", "FIXED", "FREESHIP"],
    },
    value: {
      type: Number,
      required: [true, "Giá trị giảm giá là bắt buộc."],
      min: [0.01, "Giá trị giảm giá phải lớn hơn 0."],
    },
    maxDiscount: {
      type: Number,
      default: null,
      min: [0, "Giảm giá tối đa không được âm."],
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, "Giá trị đơn hàng tối thiểu không được âm."],
    },
    totalQuantity: {
      type: Number,
      required: [true, "Số lượng voucher là bắt buộc."],
      min: [0, "Số lượng voucher không được âm."],
    },
    claimedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    usageLimitPerUser: {
      type: Number,
      default: 1,
      min: [1, "Giới hạn sử dụng mỗi user phải tối thiểu là 1."],
    },
    startDate: {
      type: Date,
      required: [true, "Ngày bắt đầu là bắt buộc."],
    },
    endDate: {
      type: Date,
      required: [true, "Ngày kết thúc là bắt buộc."],
      validate: {
        validator: function (value) {
          return value > this.startDate;
        },
        message: "Ngày kết thúc phải lớn hơn ngày bắt đầu.",
      },
    },
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    applicableUserLevels: {
      type: [String],
      default: ["standard", "silver", "gold", "vip"],
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "DISABLED"],
      default: "ACTIVE",
    },
    restoreVoucherOnCancel: {
      type: Boolean,
      default: false,
    },
    restoreOnlyIfCancelledWithinMinutes: {
      type: Number,
      default: 30,
      min: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "vouchers",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for dynamic lifecycle state calculation
voucherSchema.virtual("lifecycleState").get(function () {
  if (this.isDeleted) return "DELETED";
  if (this.status === "DRAFT") return "DRAFT";
  if (this.status === "DISABLED") return "DISABLED";
  
  const now = new Date();
  if (now > this.endDate) return "EXPIRED";
  if (now < this.startDate) return "SCHEDULED";
  if (this.claimedCount >= this.totalQuantity) return "OUT_OF_STOCK";
  
  return "ACTIVE";
});

// Enforce validation for percentage type
voucherSchema.pre("validate", function (next) {
  if (this.type === "PERCENT" && this.value > 100) {
    this.invalidate("value", "Phần trăm giảm giá không được vượt quá 100%.");
  }
  next();
});

voucherSchema.index({ code: 1 }, { unique: true });
voucherSchema.index({ isDeleted: 1, status: 1, isPublic: 1 });

const Voucher = mongoose.model("Voucher", voucherSchema);
export default Voucher;
