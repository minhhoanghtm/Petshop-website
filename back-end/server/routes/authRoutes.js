import express from 'express';
import { requestPasswordReset, resendPasswordResetOtp, resetPassword, signIn, signOut, signUp, googleSignIn, refresh } from '../controllers/authController.js';
import { sendSignupCode, verifyPasswordResetOtp, verifySignup } from '../controllers/authController.js';
import { checkDuplicate } from '../controllers/userController.js';
import { otpRateLimiterMiddleware } from '../middleware/rateLimit/otpRateLimiter.js';
import { signinIpLimiterMiddleware } from '../middleware/rateLimit/signinIpLimiter.js';

const router = express.Router();

// ===== PUBLIC AUTH ROUTES (No authentication required) =====
router.post('/signup', signUp);
router.post('/signin', signinIpLimiterMiddleware, signIn);
router.post('/google-signin', googleSignIn);
router.post('/signout', signOut);
router.post('/refresh', refresh);
router.post('/check-duplicate', checkDuplicate);
router.post('/request-password-reset', otpRateLimiterMiddleware, requestPasswordReset);
router.post('/verify-password-reset-otp', verifyPasswordResetOtp);
router.post('/resend-password-reset-otp', otpRateLimiterMiddleware, resendPasswordResetOtp);
router.post('/reset-password', resetPassword);
router.post('/send-signup-code', otpRateLimiterMiddleware, sendSignupCode);
router.post('/verify-signup', verifySignup);

export default router;