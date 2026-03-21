import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {
  validateLogin,
  validateSignup,
  validateVerifyOtp,
  validateForgotPassword,
  validateResetPassword,
} from '../validators/authValidators.js';
import {
  signup,
  login,
  verifyOtp,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/signup', validateSignup, asyncHandler(signup));
router.post('/login', validateLogin, asyncHandler(login));
router.post('/verify-otp', validateVerifyOtp, asyncHandler(verifyOtp));
router.post('/forgot-password', validateForgotPassword, asyncHandler(forgotPassword));
router.post('/reset-password', validateResetPassword, asyncHandler(resetPassword));
router.get('/profile', requireAuth, asyncHandler(getProfile));
router.put('/profile', requireAuth, asyncHandler(updateProfile));

export default router;
