import mongoose from "mongoose";

const securityLogSchema = new mongoose.Schema({
  event: {
    type: String,
    required: true,
    enum: [
      "LOGIN_SUCCESS",
      "LOGIN_FAILED",
      "ACCOUNT_LOCKED",
      "PASSWORD_CHANGED",
      "PASSWORD_RESET",
      "OTP_SUCCESS",
      "OTP_FAILED",
      "REFRESH_TOKEN_REPLAY",
      "TOKEN_REUSE_DETECTED",
      "NEW_DEVICE_LOGIN",
      "VOUCHER_CREATED",
      "VOUCHER_UPDATED",
      "VOUCHER_CLAIMED",
      "VOUCHER_APPLIED",
      "VOUCHER_EXPIRED",
      "VOUCHER_DEACTIVATED"
    ]
  },
  email: { type: String, trim: true, lowercase: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  ip: { type: String },
  userAgent: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 90 * 24 * 60 * 60 // 90 days TTL index
  }
}, { collection: "security_audit_logs" });

const SecurityLog = mongoose.model("SecurityLog", securityLogSchema);
export default SecurityLog;
