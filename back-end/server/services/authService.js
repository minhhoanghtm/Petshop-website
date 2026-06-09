import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import axios from "axios";
import { generateOTP } from "../utils/generateOTP.js";
import redisClient from "../configs/redisClient.js";
import { enqueueOtpEmail } from "../queues/otpQueue.js";
import { hasMailerConfig } from "../utils/mailer.js";
import {
  getLockStatus,
  recordFailedLogin,
  resetLoginState,
  getAttemptCount,
} from "../utils/redisLoginLock.js";
import { logger } from "../logger/logger.js";
import { createServiceError } from "../utils/serviceError.js";
import {
  EMAIL_RULE_MESSAGE,
  PASSWORD_RULE_MESSAGE,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
} from "../utils/validation.js";
import { hashPassword, verifyPassword } from "../utils/passwordUtils.js";

const ACCESS_TOKEN_TTL = "30m";
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL = 60 * 60 * 1000;
const FORGOT_PASSWORD_TTL_SECONDS = 5 * 60;
const FORGOT_PASSWORD_RESEND_COOLDOWN_SECONDS = 60;
const FORGOT_PASSWORD_MAX_RESENDS = 5;
const FORGOT_PASSWORD_MAX_ATTEMPTS = 5;
const FORGOT_PASSWORD_KEY_PREFIX = "forgot_password";

const validateEmailOrThrow = (emailRaw) => {
  const email = normalizeEmail(emailRaw);
  if (!email || !isValidEmail(email)) {
    throw createServiceError(EMAIL_RULE_MESSAGE, 400, {
      message: EMAIL_RULE_MESSAGE,
      errors: { email: EMAIL_RULE_MESSAGE },
    });
  }
  return email;
};

const validatePasswordOrThrow = (password) => {
  if (!password) {
    throw createServiceError("Mật khẩu không được để trống.", 400, {
      message: "Mật khẩu không được để trống.",
      errors: { password: "Mật khẩu không được để trống." },
    });
  }

  if (!isValidPassword(password)) {
    throw createServiceError(PASSWORD_RULE_MESSAGE, 400, {
      message: PASSWORD_RULE_MESSAGE,
      errors: { password: PASSWORD_RULE_MESSAGE },
    });
  }
};

const getForgotPasswordKey = (email) =>
  `${FORGOT_PASSWORD_KEY_PREFIX}:${String(email).trim().toLowerCase()}`;

const getForgotPasswordCooldownKey = (email) =>
  `${FORGOT_PASSWORD_KEY_PREFIX}:cooldown:${String(email).trim().toLowerCase()}`;

const normalizeLegacyLockUntil = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const timestamp = value instanceof Date ? value.getTime() : Number(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const cleanupLegacyMongoLockFields = async (user) => {
  if (!user) return;
  const hasLegacyLockUntil = user.lockUntil !== undefined && user.lockUntil !== null;
  const hasLegacyAttempts = user.loginAttempts !== undefined && user.loginAttempts !== null;
  if (!hasLegacyLockUntil && !hasLegacyAttempts) return;

  try {
    await User.updateOne(
      { _id: user._id },
      { $set: { loginAttempts: 0, lockUntil: null } },
    );

    logger.debug("Legacy MongoDB login lock fields cleaned", {
      email: user.email,
      userLoginAttempts: user.loginAttempts,
      userLockUntil: user.lockUntil,
    });
  } catch (error) {
    logger.warn("Failed to clean legacy MongoDB login lock fields", {
      email: user.email,
      message: error.message,
    });
  }
};

const readForgotPasswordState = async (email) => {
  const rawState = await redisClient.get(getForgotPasswordKey(email));

  if (!rawState) {
    return null;
  }

  try {
    return JSON.parse(rawState);
  } catch (error) {
    logger.warn("Invalid forgot-password Redis payload", {
      email,
      message: error.message,
    });
    return null;
  }
};

const persistForgotPasswordState = async (email, state) => {
  await redisClient.set(getForgotPasswordKey(email), JSON.stringify(state), {
    EX: FORGOT_PASSWORD_TTL_SECONDS,
  });
};

const createForgotPasswordState = (email, otpHash, otpPlain) => {
  const now = new Date().toISOString();

  return {
    email: String(email).trim().toLowerCase(),
    otpHash,
    verified: false,
    used: false,
    verifyAttempts: 0,
    resendCount: 0,
    expiresAt: new Date(
      Date.now() + FORGOT_PASSWORD_TTL_SECONDS * 1000,
    ).toISOString(),
    createdAt: now,
    updatedAt: now,
    verifiedAt: null,
    usedAt: null,
  };
};

const buildForgotPasswordEmail = (otp) => ({
  subject: "Mã xác thực đặt lại mật khẩu",
  text: `Mã xác thực đặt lại mật khẩu của bạn là: ${otp}. Mã có hiệu lực trong 1 phút.`,
  html: `<p>Bạn đã yêu cầu đặt lại mật khẩu.</p><p><strong>Mã xác thực của bạn là: ${otp}</strong></p><p>Mã có hiệu lực trong 1 phút.</p>`,
});

const queueForgotPasswordOtp = async ({ email, otp, purpose }) => {
  await enqueueOtpEmail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    email,
    purpose,
    otp,
    ...buildForgotPasswordEmail(otp),
  });
};

const normalizeForgotPasswordError = (message) => {
  return message || "Không thể xử lý yêu cầu đặt lại mật khẩu.";
};

// ============ Refresh Token Rotation Helpers ============

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId: userId.toString() },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "14d" }
  );
};

const storeRefreshToken = async (userId, token) => {
  const userIdStr = userId.toString();
  const tokenKey = `refresh:${token}`;
  const userSetKey = `user:refresh_tokens:${userIdStr}`;
  const ttlSeconds = Math.floor(REFRESH_TOKEN_TTL / 1000);

  try {
    // Lưu thông tin token và gán TTL 14 ngày
    await redisClient.set(tokenKey, JSON.stringify({ userId: userIdStr }), {
      EX: ttlSeconds,
    });
    // Thêm token vào danh sách quản lý của User
    await redisClient.sAdd(userSetKey, token);
    // Gán TTL cho Set của User (để tự động dọn dẹp)
    await redisClient.expire(userSetKey, ttlSeconds);
  } catch (err) {
    logger.error("Lỗi khi lưu Refresh Token vào Redis:", { message: err.message, userId: userIdStr });
  }
};

const revokeAllUserRefreshTokens = async (userId) => {
  const userIdStr = userId.toString();
  const userSetKey = `user:refresh_tokens:${userIdStr}`;

  try {
    // Lấy tất cả các refresh token đang hoạt động của User
    const tokens = await redisClient.sMembers(userSetKey);
    
    if (tokens.length > 0) {
      const keysToDelete = tokens.map(t => `refresh:${t}`);
      // Xóa tất cả các key refresh token tương ứng
      await redisClient.del(keysToDelete);
    }
    
    // Xóa luôn Set quản lý của User
    await redisClient.del(userSetKey);
    logger.warn(`Đã thu hồi toàn bộ Refresh Token của User: ${userIdStr} do nghi ngờ có Replay Attack.`);
  } catch (err) {
    logger.error("Lỗi khi thu hồi toàn bộ Refresh Token của User:", { message: err.message, userId: userIdStr });
  }
};

export const refreshAccessToken = async (oldRefreshToken) => {
  if (!oldRefreshToken) {
    throw createServiceError("Thiếu Refresh Token.", 400);
  }

  let decoded;
  try {
    // Giải mã JWT của Refresh Token để lấy userId
    decoded = jwt.verify(oldRefreshToken, process.env.ACCESS_TOKEN_SECRET);
  } catch (err) {
    throw createServiceError("Refresh Token không hợp lệ hoặc đã hết hạn.", 401);
  }

  const userId = decoded.userId;
  const tokenKey = `refresh:${oldRefreshToken}`;
  const userSetKey = `user:refresh_tokens:${userId}`;

  try {
    const redisValue = await redisClient.get(tokenKey);

    // TH1: Token KHÔNG tồn tại trên Redis -> Nghi ngờ Replay Attack (token cũ đã dùng lại ngoài thời gian ân hạn)
    if (!redisValue) {
      // Kích hoạt cơ chế tự vệ: Xóa toàn bộ token của User để hủy tất cả phiên đăng nhập
      await revokeAllUserRefreshTokens(userId);
      throw createServiceError("Phiên đăng nhập bất hợp pháp hoặc token đã hết hạn. Vui lòng đăng nhập lại.", 403);
    }

    // TH2: Token có trạng thái "used" -> Request trùng lặp trong thời gian ân hạn (Grace Period) do mạng lag
    if (redisValue.startsWith("used:")) {
      logger.info(`Phát hiện request refresh trùng lặp trong thời gian ân hạn cho user: ${userId}`);
      const cacheData = JSON.parse(redisValue.slice("used:".length));
      return {
        accessToken: cacheData.accessToken,
        refreshToken: cacheData.refreshToken,
      };
    }

    // TH3: Lần đầu tiên sử dụng Refresh Token hợp lệ -> Tạo cặp token mới
    const user = await User.findById(userId);
    if (!user || user.isBlocked || user.status !== "Active") {
      throw createServiceError("Tài khoản của bạn không tồn tại hoặc đã bị khóa.", 403);
    }

    // Tạo access/refresh token mới
    const newAccessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );
    const newRefreshToken = generateRefreshToken(user._id);

    const newPair = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };

    // Lưu Refresh Token mới vào Redis
    await storeRefreshToken(user._id, newRefreshToken);

    // Đánh dấu old token đã sử dụng (Grace Period: 10 giây)
    // Sau 10 giây Redis sẽ tự động dọn dẹp key này
    await redisClient.set(tokenKey, `used:${JSON.stringify(newPair)}`, {
      EX: 10,
    });

    // Xóa old token khỏi Set quản lý của User
    await redisClient.sRem(userSetKey, oldRefreshToken);

    logger.debug(`Đã quay vòng Refresh Token (Rotation) thành công cho user: ${userId}`);

    return {
      message: "Cấp mới Access Token thành công!",
      ...newPair,
    };
  } catch (err) {
    if (err.statusCode) throw err;
    logger.error("Lỗi khi xử lý Refresh Token:", { message: err.message, userId });
    throw createServiceError("Lỗi hệ thống khi refresh token.", 500);
  }
};

// ============ Service Functions ============

/**
 * Sign up new user
 */
export const signUp = async (userData) => {
  const { password, lastName, firstName, birthDate, gender } = userData;
  const email = validateEmailOrThrow(userData?.email);

  if (!password || !lastName || !firstName || !birthDate || !gender) {
    throw createServiceError(
      "Thiếu thông tin đăng ký. Vui lòng điền đầy đủ.",
      400,
      {
        message: "Thiếu thông tin đăng ký. Vui lòng điền đầy đủ.",
      },
    );
  }

  validatePasswordOrThrow(password);

  const duplicate = await User.findOne({ $or: [{ email }] });
  if (duplicate) {
    throw createServiceError("Email đã tồn tại.", 400, {
      message: "Email đã tồn tại.",
      errors: { email: "Email đã tồn tại." },
    });
  }

  // normalize gender to 'male'|'female'
  const normalizeGenderLocal = (val) => {
    if (typeof val === 'boolean') return val ? 'male' : 'female';
    if (typeof val === 'number') return val === 1 ? 'male' : val === 0 ? 'female' : undefined;
    if (typeof val !== 'string') return undefined;
    const n = val.trim().toLowerCase();
    if (["nam","male","m","true","1"].includes(n)) return 'male';
    if (["nu","nữ","female","f","false","0"].includes(n)) return 'female';
    return undefined;
  };

  const normalizedGender = normalizeGenderLocal(gender);
  if (typeof normalizedGender === 'undefined') {
    throw createServiceError("Giới tính không hợp lệ.", 400, {
      message: "Giới tính không hợp lệ.",
      errors: { gender: "Giới tính không hợp lệ." },
    });
  }

  const hashedPass = hashPassword(password);
  await User.create({
    email,
    password: hashedPass,
    fullName: `${firstName} ${lastName}`,
    birthDate: new Date(birthDate),
    gender: normalizedGender,
    status: "Active",
  });

  return {
    message: "Đăng ký thành công!",
    user: { email, fullName: `${firstName} ${lastName}`, birthDate, gender: normalizedGender, status: "Active" },
  };
};

/**
 * Sign in user with Redis-only login lock state
 */
export const signIn = async (userData, req) => {
  const email = validateEmailOrThrow(userData?.email);
  const password = userData.password ?? userData.passWord;
  validatePasswordOrThrow(password);

  logger.debug("Attempting signIn", {
    email,
    ip: req?.ip || req?.headers?.["x-forwarded-for"],
  });

  const redisAttempts = await getAttemptCount(email);
  const lockStatus = await getLockStatus(email);
  logger.debug("signIn lockStatus", {
    email,
    isLocked: lockStatus.isLocked,
    lockUntil: lockStatus.lockUntil,
    remainingMs: lockStatus.remainingMs,
    ttl: lockStatus.ttl,
    attempts: redisAttempts,
  });

  if (lockStatus.isLocked) {
    throw createServiceError(lockStatus.message, 429, {
      message: lockStatus.message,
      lockUntil: lockStatus.lockUntil,
      retryAfterSeconds: Math.max(0, Math.ceil(lockStatus.remainingMs / 1000)),
    });
  }

  const user = await User.findOne({ email });
  
  // Check if account is inactive - block immediately without recording attempts
  if (user && user.status !== "Active") {
    logger.warn("Blocked inactive account login attempt", {
      userId: user._id,
      email: user.email,
      ip: req?.ip || req?.headers?.["x-forwarded-for"],
    });

    throw createServiceError("Tài khoản của bạn đã bị khóa bởi hệ thống.", 403, {
      message: "Tài khoản của bạn đã bị khóa bởi hệ thống.",
    });
  }

  const mongoLoginAttempts = Number(user?.loginAttempts ?? 0);
  const mongoLockUntil = normalizeLegacyLockUntil(user?.lockUntil);
  const now = Date.now();
  const mongoIsLocked = Boolean(mongoLockUntil && mongoLockUntil > now);

  logger.debug("signIn legacy mongo lock state", {
    email,
    mongoLoginAttempts,
    mongoLockUntil,
    now,
    mongoIsLocked,
  });

  logger.debug("signIn user lookup", {
    email,
    userFound: Boolean(user),
    isBlocked: user?.isBlocked,
    lockUntil: user?.lockUntil,
    loginAttempts: mongoLoginAttempts,
    mongoIsLocked,
  });

  if (user && (user.lockUntil !== undefined || user.loginAttempts !== undefined)) {
    await cleanupLegacyMongoLockFields(user);
  }

  const passwordCorrect = user
    ? verifyPassword(password, user.password ?? user.passWord)
    : false;

  if (!user || !passwordCorrect) {
    const failure = await recordFailedLogin(email);

    if (failure.isLocked) {
      throw createServiceError(failure.message, 429, {
        message: failure.message,
        lockUntil: failure.lockUntil,
        retryAfterSeconds: Math.max(0, Math.ceil(failure.remainingMs / 1000)),
      });
    }

    logger.warn("Failed login attempt", {
      email,
      attempts: failure.attempts,
      ip: req.ip,
    });

    throw createServiceError("Email hoặc mật khẩu không đúng.", 401, {
      message: "Email hoặc mật khẩu không đúng.",
      loginAttempts: failure.attempts,
      remainingAttempts: failure.remainingAttempts,
    });
  }

  if (user.isBlocked) {
    throw createServiceError("Tài khoản của bạn đã bị khóa bởi hệ thống.", 403, {
      message: "Tài khoản của bạn đã bị khóa bởi hệ thống.",
    });
  }

  await resetLoginState(email);

  const accessToken = jwt.sign(
    { userId: user._id },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );

  const refreshToken = generateRefreshToken(user._id);
  await storeRefreshToken(user._id, refreshToken);

  if (req && req.session) {
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        req.session.userId = user._id.toString();
        req.session.email = user.email;
        req.session.refreshToken = refreshToken;
        req.session.save((err2) => (err2 ? reject(err2) : resolve()));
      });
    });
  }

  return {
    message: `User ${user.fullName} đã login!`,
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatar: user.avatar,
    },
  };
};

/**
 * Sign out user
 */
export const signOut = async (token, req) => {
  if (token) {
    try {
      await redisClient.del(`refresh:${token}`);
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        await redisClient.sRem(`user:refresh_tokens:${decoded.userId}`, token);
      } catch {
        // Bỏ qua lỗi verify khi logout
      }
    } catch (err) {
      logger.warn("Không thể xóa refreshToken trên Redis", {
        message: err.message,
      });
    }

    if (req.session) {
      req.session.destroy((err) => {
        if (err)
          logger.warn("Lỗi khi destroy session", { message: err.message });
      });
    }
  }

  return {
    message: "Đăng xuất thành công!",
  };
};

/**
 * Request password reset
 */
export const requestPasswordReset = async (userData) => {
  const email = validateEmailOrThrow(userData?.email);

  const user = await User.findOne({ email });
  if (!user) {
    throw createServiceError("Không tìm thấy tài khoản với email này!", 404, {
      message: "Không tìm thấy tài khoản với email này!",
      errors: { email: "Không tìm thấy tài khoản với email này!" },
    });
  }

  const resetCode = String(crypto.randomInt(100000, 1000000));
  const otpHash = bcrypt.hashSync(resetCode, 10);
  const forgotPasswordState = createForgotPasswordState(email, otpHash);

  await persistForgotPasswordState(email, forgotPasswordState);
  await redisClient.set(getForgotPasswordCooldownKey(email), "1", {
    EX: FORGOT_PASSWORD_RESEND_COOLDOWN_SECONDS,
  });
  await queueForgotPasswordOtp({
    email,
    otp: resetCode,
    purpose: "password-reset",
  });

  logger.info("Forgot-password OTP requested", {
    email,
    resendCooldownSeconds: FORGOT_PASSWORD_RESEND_COOLDOWN_SECONDS,
    otpExpiresInSeconds: FORGOT_PASSWORD_TTL_SECONDS,
  });

  return {
    message: "Đã gửi mã xác thực đặt lại mật khẩu!",
    nextResendInSeconds: FORGOT_PASSWORD_RESEND_COOLDOWN_SECONDS,
    otpExpiresInSeconds: FORGOT_PASSWORD_TTL_SECONDS,
  };
};

/**
 * Verify forgot-password OTP
 */
export const verifyPasswordResetOtp = async (userData) => {
  const { email, code, otp } = userData;
  const inputOtp = String(code ?? otp ?? "").trim();

  if (!email || !inputOtp) {
    throw createServiceError("Thiếu email hoặc mã OTP!", 400, {
      message: "Thiếu email hoặc mã OTP!",
      errors: {
        ...(email ? {} : { email: EMAIL_RULE_MESSAGE }),
        ...(inputOtp ? {} : { code: "Vui lòng nhập mã OTP." }),
      },
    });
  }

  const normalizedEmail = validateEmailOrThrow(email);
  const state = await readForgotPasswordState(normalizedEmail);
  if (!state) {
    throw new Error("OTP không tồn tại hoặc đã hết hạn!");
  }

  const isExpired =
    !state.expiresAt || new Date(state.expiresAt).getTime() < Date.now();
  if (isExpired) {
    await redisClient.del(getForgotPasswordKey(normalizedEmail));
    await redisClient.del(getForgotPasswordCooldownKey(normalizedEmail));
    throw new Error("OTP đã hết hạn!");
  }

  if (state.used) {
    throw new Error("OTP đã được sử dụng!");
  }

  if (state.verifyAttempts >= FORGOT_PASSWORD_MAX_ATTEMPTS) {
    throw new Error("Bạn đã nhập sai OTP quá nhiều lần!");
  }

  const isOtpValid = bcrypt.compareSync(inputOtp, state.otpHash);
  if (!isOtpValid) {
    const updatedState = {
      ...state,
      verifyAttempts: state.verifyAttempts + 1,
      updatedAt: new Date().toISOString(),
    };

    await persistForgotPasswordState(normalizedEmail, updatedState);

    if (updatedState.verifyAttempts >= FORGOT_PASSWORD_MAX_ATTEMPTS) {
      throw new Error("Bạn đã nhập sai OTP quá nhiều lần!");
    }

    throw new Error("OTP không đúng!");
  }

  const verifiedState = {
    ...state,
    verified: true,
    verifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verifyAttempts: 0,
  };

  await persistForgotPasswordState(normalizedEmail, verifiedState);

  logger.info("Forgot-password OTP verified", {
    email,
    verifyAttempts: verifiedState.verifyAttempts,
  });

  return {
    message: "Xác thực OTP thành công!",
    verified: true,
    otpExpiresInSeconds: Math.max(
      0,
      Math.floor(
        (new Date(verifiedState.expiresAt).getTime() - Date.now()) / 1000,
      ),
    ),
  };
};

/**
 * Resend forgot-password OTP
 */
export const resendPasswordResetOtp = async (userData) => {
  const email = validateEmailOrThrow(userData?.email);

  const user = await User.findOne({ email });
  if (!user) {
    throw createServiceError("Không tìm thấy tài khoản với email này!", 404, {
      message: "Không tìm thấy tài khoản với email này!",
      errors: { email: "Không tìm thấy tài khoản với email này!" },
    });
  }

  const cooldown = await redisClient.get(getForgotPasswordCooldownKey(email));
  if (cooldown) {
    throw new Error(
      `Vui lòng chờ ${FORGOT_PASSWORD_RESEND_COOLDOWN_SECONDS}s trước khi gửi lại mã OTP.`,
    );
  }

  const state = await readForgotPasswordState(email);
  if (!state) {
    throw new Error("OTP không tồn tại hoặc đã hết hạn!");
  }

  if (state.resendCount >= FORGOT_PASSWORD_MAX_RESENDS) {
    throw new Error("Bạn đã vượt quá số lần gửi lại OTP!");
  }

  const newOtp = String(crypto.randomInt(100000, 1000000));
  const newOtpHash = bcrypt.hashSync(newOtp, 10);
  const nextState = {
    ...state,
    otpHash: newOtpHash,
    otpPlain: newOtp,
    verified: false,
    used: false,
    verifyAttempts: 0,
    resendCount: state.resendCount + 1,
    expiresAt: new Date(
      Date.now() + FORGOT_PASSWORD_TTL_SECONDS * 1000,
    ).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await persistForgotPasswordState(email, nextState);
  await redisClient.set(getForgotPasswordCooldownKey(email), "1", {
    EX: FORGOT_PASSWORD_RESEND_COOLDOWN_SECONDS,
  });
  await queueForgotPasswordOtp({
    email,
    otp: newOtp,
    purpose: "password-reset-resend",
  });

  logger.info("Forgot-password OTP resent", {
    email,
    resendCount: nextState.resendCount,
    resendCooldownSeconds: FORGOT_PASSWORD_RESEND_COOLDOWN_SECONDS,
    otpExpiresInSeconds: FORGOT_PASSWORD_TTL_SECONDS,
  });

  return {
    message: "Đã gửi lại mã OTP!",
    nextResendInSeconds: FORGOT_PASSWORD_RESEND_COOLDOWN_SECONDS,
    otpExpiresInSeconds: FORGOT_PASSWORD_TTL_SECONDS,
  };
};

/**
 * Reset password with code
 */
export const resetPassword = async (userData) => {
  const { email, newPassword, passWord } = userData;
  const password = newPassword ?? passWord;

  const normalizedEmail = validateEmailOrThrow(email);
  validatePasswordOrThrow(password);

  const state = await readForgotPasswordState(normalizedEmail);
  if (!state) {
    throw new Error("OTP không tồn tại hoặc đã hết hạn!");
  }

  const isExpired =
    !state.expiresAt || new Date(state.expiresAt).getTime() < Date.now();
  if (isExpired) {
    await redisClient.del(getForgotPasswordKey(email));
    await redisClient.del(getForgotPasswordCooldownKey(email));
    throw new Error("OTP đã hết hạn!");
  }

  if (!state.verified) {
    throw new Error("Vui lòng xác thực OTP trước khi đặt lại mật khẩu!");
  }

  if (state.used) {
    throw new Error("OTP đã được sử dụng!");
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw createServiceError("Không tìm thấy tài khoản với email này!", 404, {
      message: "Không tìm thấy tài khoản với email này!",
      errors: { email: "Không tìm thấy tài khoản với email này!" },
    });
  }

  await User.updateOne(
    { email: normalizedEmail },
    {
      $set: {
        password: hashPassword(password),
      },
    },
  );

  await redisClient.del(getForgotPasswordKey(normalizedEmail));
  await redisClient.del(getForgotPasswordCooldownKey(normalizedEmail));
  await redisClient.del(
    `${FORGOT_PASSWORD_KEY_PREFIX}:resendcount:${String(normalizedEmail).trim().toLowerCase()}`,
  );

  logger.info("Forgot-password reset succeeded", {
    email,
    userId: user._id.toString(),
  });

  return {
    message: "Đặt lại mật khẩu thành công!",
  };
};

/**
 * Send signup verification code
 */
export const sendSignupCode = async (userData) => {
  const { password, lastName, firstName, birthDate, gender } = userData;
  const email = validateEmailOrThrow(userData?.email);

  if (!email || !password || !lastName || !firstName || !birthDate || !gender) {
    throw createServiceError(
      "Thiếu thông tin đăng ký. Vui lòng điền đầy đủ.",
      400,
      {
        message: "Thiếu thông tin đăng ký. Vui lòng điền đầy đủ.",
      },
    );
  }

  validatePasswordOrThrow(password);

  const existing = await User.findOne({ $or: [{ email }] });
  if (existing) {
    throw createServiceError("Email đã được sử dụng.", 400, {
      message: "Email đã được sử dụng.",
      errors: { email: "Email đã được sử dụng." },
    });
  }

  const resendKey = `signup_cooldown:${email}`;
  const cooldown = await redisClient.get(resendKey);
  if (cooldown) {
    throw new Error("Vui lòng chờ trước khi yêu cầu mã xác thực mới.");
  }

  const signupCode = generateOTP();
  const hashedOTP = bcrypt.hashSync(signupCode, 10);
  const storedPassword = hashPassword(password);

  // normalize gender locally
  const normalizeGenderLocal = (val) => {
    if (typeof val === 'boolean') return val ? 'male' : 'female';
    if (typeof val === 'number') return val === 1 ? 'male' : val === 0 ? 'female' : undefined;
    if (typeof val !== 'string') return undefined;
    const n = val.trim().toLowerCase();
    if (["nam","male","m","true","1"].includes(n)) return 'male';
    if (["nu","nữ","female","f","false","0"].includes(n)) return 'female';
    return undefined;
  };

  const normalizedGender = normalizeGenderLocal(gender);
  if (typeof normalizedGender === 'undefined') {
    throw createServiceError("Giới tính không hợp lệ.", 400, {
      message: "Giới tính không hợp lệ.",
      errors: { gender: "Giới tính không hợp lệ." },
    });
  }

  const payload = {
    email,
    password: storedPassword,
    lastName,
    firstName,
    birthDate: new Date(birthDate),
    gender: normalizedGender,
  };

  await redisClient.set(
    `signup:${email}`,
    JSON.stringify({ code: hashedOTP, payload }),
    { EX: 60 },
  );

  if (!hasMailerConfig()) {
    if (process.env.NODE_ENV !== "production") {
      return {
        message:
          "SMTP chưa được cấu hình. Mã đăng ký được trả về cho môi trường dev.",
        devCode: signupCode,
      };
    }

    throw new Error("Thiếu cấu hình SMTP để gửi email.");
  }

  await enqueueOtpEmail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    email,
    purpose: "signup-verification",
    subject: "Mã xác thực đăng ký tài khoản",
    text: `Mã xác thực đăng ký của bạn là: ${signupCode}. Mã có hiệu lực trong 1 phút.`,
    html: `<p>Mã xác thực đăng ký của bạn là: <strong>${signupCode}</strong></p><p>Mã có hiệu lực trong 1 phút.</p>`,
    code: signupCode,
  });

  await redisClient.set(resendKey, "1", { EX: 60 });

  return {
    message: "Đã gửi mã xác thực đến email.",
  };
};

/**
 * Verify signup code and create user
 */
export const verifySignup = async (userData) => {
  const email = validateEmailOrThrow(userData?.email);
  const { code } = userData;

  if (!email || !code) {
    throw createServiceError("Thiếu email hoặc mã xác thực.", 400, {
      message: "Thiếu email hoặc mã xác thực.",
      errors: {
        ...(email ? {} : { email: EMAIL_RULE_MESSAGE }),
        ...(code ? {} : { code: "Vui lòng nhập mã xác thực." }),
      },
    });
  }

  const redisData = await redisClient.get(`signup:${email}`);
  if (!redisData) {
    throw new Error("Mã xác thực không hợp lệ hoặc đã hết hạn.");
  }

  const parsedData = JSON.parse(redisData);
  const isCodeValid = bcrypt.compareSync(code, parsedData.code);
  if (!isCodeValid) {
    throw new Error("Mã xác thực không hợp lệ hoặc đã hết hạn.");
  }

  const payload = parsedData.payload;

  const existing = await User.findOne({
    $or: [{ email }],
  });
  if (existing) {
    throw new Error("Email đã được sử dụng.");
  }

  await User.create({
    email: payload.email,
    password: payload.password,
    fullName: `${payload.firstName} ${payload.lastName}`,
    birthDate: payload.birthDate,
    gender: payload.gender,
  });

  await redisClient.del(`signup:${email}`);
  await redisClient.del(`signup_cooldown:${email}`);

  return {
    message: "Đăng ký thành công!",
  };
};

/**
 * Sign in user with Google OAuth
 */
export const googleSignIn = async (body, req) => {
  const { token, accessToken } = body;
  const gToken = token || accessToken;

  if (!gToken) {
    throw createServiceError("Thiếu Google access token.", 400);
  }

  // Gọi Google API để lấy thông tin profile
  let googleUser;
  try {
    const response = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${gToken}`,
        },
      }
    );
    googleUser = response.data;
  } catch (err) {
    logger.warn("Xác thực Google Access Token thất bại", {
      message: err.message,
    });
    throw createServiceError("Đăng nhập bằng Google thất bại. Token không hợp lệ.", 401);
  }

  const { email, name, picture } = googleUser;
  if (!email) {
    throw createServiceError("Không lấy được email từ tài khoản Google.", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });

  if (user) {
    // Tài khoản đã tồn tại
    if (user.isBlocked || user.status !== "Active") {
      throw createServiceError("Tài khoản của bạn đã bị khóa bởi hệ thống.", 403);
    }
    // Cập nhật avatar nếu chưa có
    if (!user.avatar && picture) {
      await User.updateOne({ _id: user._id }, { $set: { avatar: picture } });
      user.avatar = picture;
    }
  } else {
    // Tạo tài khoản mới
    const randomPass = crypto.randomBytes(16).toString("hex");
    const hashedPass = hashPassword(randomPass);

    user = await User.create({
      email: normalizedEmail,
      password: hashedPass,
      fullName: name || "Google User",
      birthDate: new Date("1990-01-01"), // Mặc định bắt buộc
      gender: "male", // Mặc định bắt buộc
      status: "Active", // Tài khoản đăng nhập qua MXH được active luôn
      avatar: picture || "",
      role: "user",
    });
  }

  // Sinh JWT tokens cho hệ thống
  const systemAccessToken = jwt.sign(
    { userId: user._id },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  const systemRefreshToken = generateRefreshToken(user._id);
  await storeRefreshToken(user._id, systemRefreshToken);

  // Đồng bộ session nếu có session store
  if (req && req.session) {
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        req.session.userId = user._id.toString();
        req.session.email = user.email;
        req.session.refreshToken = systemRefreshToken;
        req.session.save((err2) => (err2 ? reject(err2) : resolve()));
      });
    });
  }

  return {
    message: `Đăng nhập thành công bằng Google!`,
    accessToken: systemAccessToken,
    refreshToken: systemRefreshToken,
    user: {
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatar: user.avatar,
    },
  };
};
