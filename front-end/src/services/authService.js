import axiosInstance from "../utils/axiosInstance";

export const signIn = (payload) => axiosInstance.post("/api/auth/signin", payload);

export const signInWithGoogle = (payload) => axiosInstance.post("/api/auth/google-signin", payload);

export const signUp = (payload) => axiosInstance.post("/api/auth/signup", payload);

export const checkDuplicate = (payload) =>
  axiosInstance.post("/api/auth/check-duplicate", payload);

export const signOut = () => axiosInstance.post("/api/auth/signout");

export const requestPasswordReset = (payload) =>
  axiosInstance.post("/api/auth/request-password-reset", payload);

export const verifyPasswordResetOtp = (payload) =>
  axiosInstance.post("/api/auth/verify-password-reset-otp", payload);

export const resendPasswordResetOtp = (payload) =>
  axiosInstance.post("/api/auth/resend-password-reset-otp", payload);

export const resetPassword = (payload) =>
  axiosInstance.post("/api/auth/reset-password", payload);

export const sendSignupCode = (payload) =>
  axiosInstance.post("/api/auth/send-signup-code", payload);

export const verifySignup = (payload) =>
  axiosInstance.post("/api/auth/verify-signup", payload);