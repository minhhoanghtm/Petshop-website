import mongoose from "mongoose";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\d{10,11}$/;

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    validate: {
      validator: (value) => !value || PHONE_REGEX.test(String(value).trim()),
      message: "Số điện thoại chỉ được chứa chữ số và có độ dài từ 10 đến 11 số.",
    },
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [EMAIL_REGEX, "Vui lòng nhập địa chỉ email hợp lệ."],
  },
  birthDate: { type: Date, required: true },
  password: { type: String, required: true },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  role: { type: String, default: 'user' },
  avatar: { type: String },
  gender: {
    type: String,
    enum: ["male", "female"],
    required: true,
    default: "male",
  },
  isBlocked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  address: { type: String },
  shippingAddress: {
    receiverName: { type: String, default: "" },
    phone: { type: String, default: "" },
    province: { type: String, default: "" },
    district: { type: String, default: "" },
    ward: { type: String, default: "" },
    detailAddress: { type: String, default: "" },
    updatedAt: { type: Date, default: null },
  },
  status: { type: String, default: 'Inactive', enum: ['Active', 'Inactive'] },
  lastActive: { type: Date, default: null },
  level: { type: String, default: 'standard', enum: ['standard', 'silver', 'gold', 'vip'] },
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);
export default User;
