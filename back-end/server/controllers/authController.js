import * as authService from "../services/authService.js";
import { sendControllerError } from "../utils/controllerError.js";
import { logger } from "../logger/logger.js";


//Đăng ký
export const signUp = async (req, res) => {
  try {
    const result = await authService.signUp(req.body);
    return res.status(201).json(result);
  } catch (error) {
    logger.warn("Lỗi khi gọi signup", {
      message: error.message,
      email: req.body?.email,
    });
    return sendControllerError(res, error, 400);
  }
};

//Đăng nhập
export const signIn = async (req, res) => {
  try {
    const result = await authService.signIn(req.body, req);
    logger.debug("authController.signIn request", {
      email: req.body?.email,
      ip: req.ip || req.headers["x-forwarded-for"],
    });

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: result.message,
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    logger.warn("Lỗi khi gọi signin", {
      message: error.message,
      email: req.body?.email,
      ip: req.ip || req.headers["x-forwarded-for"],
    });
    return sendControllerError(res, error, error.statusCode || 401);
  }
};

//Đăng xuất
export const signOut = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    const result = await authService.signOut(token, req);

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.warn("Lỗi khi gọi signout", {
      message: error.message,
      email: req.body?.email,
    });
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

//Yêu cầu đặt lại mật khẩu
export const requestPasswordReset = async (req, res) => {
  try {
    const result = await authService.requestPasswordReset(req.body);
    return res.status(200).json(result);
  } catch (error) {
    logger.warn("Lỗi khi gọi requestPasswordReset", {
      message: error.message,
      email: req.body?.email,
    });
    return sendControllerError(res, error, 400);
  }
};

//Xác thực OTP quên mật khẩu
export const verifyPasswordResetOtp = async (req, res) => {
  try {
    const result = await authService.verifyPasswordResetOtp(req.body, req);
    return res.status(200).json(result);
  } catch (error) {
    logger.warn("Lỗi khi gọi verifyPasswordResetOtp", {
      message: error.message,
      email: req.body?.email,
    });
    return sendControllerError(res, error, error.statusCode || 400);
  }
};

//Gửi lại OTP quên mật khẩu
export const resendPasswordResetOtp = async (req, res) => {
  try {
    const result = await authService.resendPasswordResetOtp(req.body, req);
    return res.status(200).json(result);
  } catch (error) {
    logger.warn("Lỗi khi gọi resendPasswordResetOtp", {
      message: error.message,
      email: req.body?.email,
    });
    return sendControllerError(res, error, error.statusCode || 400);
  }
};

//Đặt lại mật khẩu
export const resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body, req);
    return res.status(200).json(result);
  } catch (error) {
    logger.warn("Lỗi khi gọi resetPassword", {
      message: error.message,
      email: req.body?.email,
    });
    return sendControllerError(res, error, error.statusCode || 400);
  }
};

//Gửi mã xác thực đăng ký
export const sendSignupCode = async (req, res) => {
  try {
    const result = await authService.sendSignupCode(req.body, req);
    return res.status(200).json(result);
  } catch (error) {
    logger.warn("Lỗi khi gọi sendSignupCode", {
      message: error.message,
      email: req.body?.email,
    });
    return sendControllerError(res, error, error.statusCode || 400);
  }
};

//Xác thực mã đăng ký và tạo tài khoản
export const verifySignup = async (req, res) => {
  try {
    const result = await authService.verifySignup(req.body, req);
    return res.status(201).json(result);
  } catch (error) {
    logger.warn("Lỗi khi gọi verifySignup", {
      message: error.message,
      email: req.body?.email,
    });
    return sendControllerError(res, error, error.statusCode || 400);
  }
};

// Đăng nhập bằng Google
export const googleSignIn = async (req, res) => {
  try {
    const result = await authService.googleSignIn(req.body, req);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: result.message,
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    logger.warn("Lỗi khi gọi googleSignIn", {
      message: error.message,
    });
    return sendControllerError(res, error, error.statusCode || 400);
  }
};

// Quay vòng Refresh Token (Rotation)
export const refresh = async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  try {
    const result = await authService.refreshAccessToken(token, req);

    // Lưu Refresh Token mới vào cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: result.message,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.warn("Xác thực hoặc quay vòng Refresh Token thất bại", {
      message: error.message,
    });
    
    // Nếu bị Replay Attack và quăng lỗi 403, xóa cookie refreshToken trên client ngay lập tức
    if (error.statusCode === 403) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
      });
    }
    
    return sendControllerError(res, error, error.statusCode || 401);
  }
};
