import express from 'express';
import { requestPasswordReset, resendPasswordResetOtp, resetPassword, signIn, signOut, signUp, googleSignIn, refresh } from '../controllers/authController.js';
import { sendSignupCode, verifyPasswordResetOtp, verifySignup } from '../controllers/authController.js';
import { checkDuplicate } from '../controllers/userController.js';
import { otpSendLimiterMiddleware } from '../middleware/rateLimit/otpLimiter.js';

const router = express.Router();

// ===== PUBLIC AUTH ROUTES (No authentication required) =====
router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/google-signin', googleSignIn);
router.post('/signout', signOut);
router.post('/refresh', refresh);
router.post('/check-duplicate', checkDuplicate);
router.post('/request-password-reset', otpSendLimiterMiddleware, requestPasswordReset);
router.post('/verify-password-reset-otp', verifyPasswordResetOtp);
router.post('/resend-password-reset-otp', otpSendLimiterMiddleware, resendPasswordResetOtp);
router.post('/reset-password', resetPassword);
router.post('/send-signup-code', otpSendLimiterMiddleware, sendSignupCode);
router.post('/verify-signup', verifySignup);

export default router;