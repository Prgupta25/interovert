import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import env from '../config/env.js';
import { generateOtpCode, sendOtpEmail, sendPasswordResetEmail } from '../services/authService.js';
import { uploadIfBase64, deleteImage as cloudinaryDelete } from '../services/cloudinaryService.js';

export async function signup(req, res) {
  const { name, email, password, phoneNumber, whatsappNumber, birthdate } = req.body || {};
  const trimmedEmail = String(email).trim().toLowerCase();

  const existingUser = await User.findOne({ email: trimmedEmail });
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);
  const normalizedWhatsapp = whatsappNumber ? String(whatsappNumber).trim() : String(phoneNumber).trim();

  const user = new User({
    name: String(name).trim(),
    email: trimmedEmail,
    password: hashedPassword,
    phoneNumber: String(phoneNumber).trim(),
    whatsappNumber: normalizedWhatsapp,
    dateOfBirth: birthdate ? new Date(birthdate) : undefined,
  });

  await user.save();
  return res.status(201).json({ message: 'User created successfully' });
}

export async function login(req, res) {
  const { email, password, phoneNumber, whatsappNumber } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  const validPassword = await bcrypt.compare(String(password || ''), user.password);
  if (!validPassword) {
    return res.status(400).json({ message: 'Invalid password' });
  }

  if (!user.phoneNumber) {
    if (!phoneNumber) {
      return res.status(400).json({
        message: 'Phone number is required for this account. Please add it and login again.',
      });
    }
    user.phoneNumber = String(phoneNumber).trim();
    user.whatsappNumber = whatsappNumber
      ? String(whatsappNumber).trim()
      : String(phoneNumber).trim();
  }

  const otp = generateOtpCode();
  user.otp = otp;
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  const sent = await sendOtpEmail(normalizedEmail, otp);
  if (!sent) {
    if (env.nodeEnv !== 'production') {
      return res.status(200).json({
        message: 'OTP email failed, using development fallback OTP',
        devOtp: otp,
      });
    }
    return res.status(503).json({ message: 'Could not send OTP email' });
  }

  return res.json({ message: 'OTP sent to your email' });
}

const FORGOT_OK_MESSAGE = 'You will receive password reset instructions shortly.';

export async function forgotPassword(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ message: FORGOT_OK_MESSAGE });
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = token;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const base = (env.publicAppUrl || env.frontendUrl || 'http://localhost:5173').replace(/\/$/, '');
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (/localhost|127\.0\.0\.1/i.test(base)) {
    console.warn(
      '[auth] Password reset link uses localhost — it will not open on another device (e.g. phone). '
        + 'Set PUBLIC_APP_URL or FRONTEND_URL to your deployed app (https://…) or your PC LAN IP for Wi‑Fi testing.',
    );
  }

  const sent = await sendPasswordResetEmail(email, resetUrl);
  if (!sent) {
    if (env.nodeEnv !== 'production') {
      console.warn('[dev] Password reset email not sent. Link:', resetUrl);
      return res.json({
        message: 'Email could not be sent (check RESEND_API_KEY or EMAIL_USER/EMAIL_PASS in .env).',
        devResetUrl: resetUrl,
      });
    }
    return res.status(503).json({ message: 'Could not send reset email. Try again later.' });
  }

  return res.json({ message: FORGOT_OK_MESSAGE });
}

export async function resetPassword(req, res) {
  const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
  const tokenStr = String(req.body?.token || '').trim();
  const password = req.body?.password;

  const user = await User.findOne({
    email: normalizedEmail,
    passwordResetToken: tokenStr,
    passwordResetExpires: { $gt: new Date() },
  });
  if (!user) {
    return res.status(400).json({
      message: 'Invalid or expired reset link. Request a new password reset from the login page.',
    });
  }

  user.password = await bcrypt.hash(String(password), 10);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  return res.json({ message: 'Password updated. You can sign in with your new password.' });
}

export async function verifyOtp(req, res) {
  const { email, otp } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  if (user.otp !== otp || Date.now() > user.otpExpiry) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  const token = jwt.sign({ userId: user._id }, env.jwtSecret, { expiresIn: '7d' });
  return res.json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      whatsappNumber: user.whatsappNumber || user.phoneNumber,
      dateOfBirth: user.dateOfBirth,
    },
  });
}

export async function getProfile(req, res) {
  return res.json(req.user);
}

export async function updateProfile(req, res) {
  const payload = req.body || {};
  const incomingProfile = payload.profile || {};

  let avatar = incomingProfile.avatar ?? req.user.profile?.avatar ?? null;
  if (incomingProfile.avatar && incomingProfile.avatar.startsWith('data:')) {
    const oldAvatar = req.user.profile?.avatar;
    avatar = await uploadIfBase64(incomingProfile.avatar, 'interovert/avatars');
    if (oldAvatar?.includes('cloudinary.com') && avatar !== oldAvatar) {
      cloudinaryDelete(oldAvatar).catch(() => {});
    }
  }

  const updates = {
    profile: {
      avatar,
      lookingFor: Array.isArray(incomingProfile.lookingFor) ? incomingProfile.lookingFor : req.user.profile?.lookingFor ?? [],
      interests: Array.isArray(incomingProfile.interests) ? incomingProfile.interests : req.user.profile?.interests ?? [],
      customInterests: Array.isArray(incomingProfile.customInterests) ? incomingProfile.customInterests : req.user.profile?.customInterests ?? [],
      aboutMe: Array.isArray(incomingProfile.aboutMe) ? incomingProfile.aboutMe : req.user.profile?.aboutMe ?? [],
      customAboutMe: Array.isArray(incomingProfile.customAboutMe) ? incomingProfile.customAboutMe : req.user.profile?.customAboutMe ?? [],
      bio: typeof incomingProfile.bio === 'string' ? incomingProfile.bio : req.user.profile?.bio ?? '',
      skills: typeof incomingProfile.skills === 'object' && incomingProfile.skills !== null
        ? incomingProfile.skills
        : req.user.profile?.skills ?? {},
      socialLinks: {
        github: incomingProfile.socialLinks?.github ?? req.user.profile?.socialLinks?.github ?? '',
        linkedin: incomingProfile.socialLinks?.linkedin ?? req.user.profile?.socialLinks?.linkedin ?? '',
        twitter: incomingProfile.socialLinks?.twitter ?? req.user.profile?.socialLinks?.twitter ?? '',
        instagram: incomingProfile.socialLinks?.instagram ?? req.user.profile?.socialLinks?.instagram ?? '',
        facebook: incomingProfile.socialLinks?.facebook ?? req.user.profile?.socialLinks?.facebook ?? '',
        website: incomingProfile.socialLinks?.website ?? req.user.profile?.socialLinks?.website ?? '',
      },
    },
  };

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  }).select('-password -otp -otpExpiry');

  return res.json(user);
}
