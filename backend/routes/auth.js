import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {
  validateLogin,
  validateSignup,
  validateVerifyOtp,
} from '../validators/authValidators.js';
import {
  signup,
  login,
  verifyOtp,
  getProfile,
  updateProfile,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/signup', validateSignup, asyncHandler(signup));
router.post('/login', validateLogin, asyncHandler(login));
router.post('/verify-otp', validateVerifyOtp, asyncHandler(verifyOtp));
router.get('/profile', requireAuth, asyncHandler(getProfile));
router.put('/profile', requireAuth, asyncHandler(updateProfile));

export default router;
