import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Address from '../models/Address.js';
import Event from '../models/Event.js';
import EventParticipant from '../models/EventParticipant.js';
import env from '../config/env.js';
import { geocodeAddress, buildFormattedAddress } from '../services/geocodeService.js';
import { generateOtpCode, sendOtpEmail, sendPasswordResetEmail } from '../services/authService.js';
import { uploadIfBase64, deleteImage as cloudinaryDelete } from '../services/cloudinaryService.js';

export async function signup(req, res) {
  const { name, email, password, phoneNumber, whatsappNumber, birthdate, address } = req.body || {};
  const trimmedEmail = String(email).trim().toLowerCase();

  const existingUser = await User.findOne({ email: trimmedEmail });
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const line1 = String(address?.line1 || '').trim();
  const city = String(address?.city || '').trim();
  const formatted = buildFormattedAddress({
    line1,
    line2: String(address?.line2 || '').trim(),
    city,
    state: String(address?.state || '').trim(),
    postalCode: String(address?.postalCode || '').trim(),
    country: String(address?.country || '').trim(),
  });
  const geocode = await geocodeAddress(formatted);
  const isAddressVerified =
    !!geocode && typeof geocode.lat === 'number' && typeof geocode.lng === 'number';

  const hashedPassword = await bcrypt.hash(String(password), 10);
  const phone = String(phoneNumber || '').trim();
  const wa = String(whatsappNumber || '').trim();
  const normalizedWhatsapp = wa || phone;

  const user = new User({
    name: String(name).trim(),
    email: trimmedEmail,
    password: hashedPassword,
    phoneNumber: phone,
    whatsappNumber: normalizedWhatsapp,
    dateOfBirth: birthdate ? new Date(birthdate) : undefined,
  });

  await user.save();

  try {
    await Address.create({
      owner_id: user._id,
      type: 'user',
      label: String(address?.label || 'Home').trim() || 'Home',
      line1,
      line2: String(address?.line2 || '').trim(),
      city,
      state: String(address?.state || '').trim(),
      country: String(address?.country || '').trim(),
      postalCode: String(address?.postalCode || '').trim(),
      formattedAddress: formatted,
      geocode: isAddressVerified ? geocode : null,
      is_verified: isAddressVerified,
    });
  } catch (err) {
    await User.findByIdAndDelete(user._id);
    console.error('[signup] address save failed:', err?.message || err);
    return res.status(500).json({ message: 'Could not save your address. Please try again.' });
  }

  const otp = generateOtpCode();
  user.otp = otp;
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  const sent = await sendOtpEmail(trimmedEmail, otp, { purpose: 'signup' });
  if (!sent) {
    if (env.nodeEnv !== 'production') {
      return res.status(201).json({
        message: 'Account created. OTP email failed in development — use the code below.',
        devOtp: otp,
      });
    }
    await Address.deleteMany({ owner_id: user._id });
    await User.findByIdAndDelete(user._id);
    return res.status(503).json({ message: 'Could not send OTP email. Please try again.' });
  }

  return res.status(201).json({
    message: 'Account created. Enter the verification code we emailed you.',
  });
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  const validPassword = await bcrypt.compare(String(password || ''), user.password);
  if (!validPassword) {
    return res.status(400).json({ message: 'Invalid password' });
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
    const pub = env.publicAppUrl ? JSON.stringify(env.publicAppUrl) : '(unset)';
    const fr = env.frontendUrl ? JSON.stringify(env.frontendUrl) : '(unset)';
    console.warn(
      '[auth] Password reset link fell back to localhost. '
        + 'PUBLIC_APP_URL / FRONTEND_URL must be set on *this API service* (e.g. Cloud Run → Variables), not Vercel. '
        + `Currently PUBLIC_APP_URL=${pub} FRONTEND_URL=${fr}. Redeploy API after changing env.`,
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

function countedParticipantFilter(userId) {
  return {
    participant_id: userId,
    paymentStatus: { $nin: ['pending', 'failed'] },
  };
}

async function getProfileActivityStats(userId) {
  const filter = countedParticipantFilter(userId);
  const eventColl = Event.collection.collectionName;

  const [eventsJoined, pastMeetupsAgg, myParts] = await Promise.all([
    EventParticipant.countDocuments(filter),
    EventParticipant.aggregate([
      { $match: filter },
      { $lookup: { from: eventColl, localField: 'event_id', foreignField: '_id', as: 'ev' } },
      { $unwind: '$ev' },
      { $match: { 'ev.datetime': { $lt: new Date() } } },
      { $count: 'c' },
    ]),
    EventParticipant.find(filter).select('event_id').lean(),
  ]);

  const eventIdStrs = [...new Set(myParts.map((p) => String(p.event_id)))];
  let connections = 0;
  if (eventIdStrs.length > 0) {
    const eventObjectIds = eventIdStrs.map((id) => new mongoose.Types.ObjectId(id));
    const others = await EventParticipant.distinct('participant_id', {
      event_id: { $in: eventObjectIds },
      participant_id: { $ne: userId },
    });
    connections = others.length;
  }

  return {
    eventsJoined,
    pastMeetups: pastMeetupsAgg[0]?.c ?? 0,
    connections,
  };
}

export async function getProfile(req, res) {
  const addresses = await Address.find({ owner_id: req.user._id, type: 'user' })
    .sort({ createdAt: -1 })
    .lean();
  const userJson = req.user.toObject ? req.user.toObject() : req.user;
  const stats = await getProfileActivityStats(req.user._id);
  return res.json({ ...userJson, addresses, stats });
}

export async function updateProfile(req, res) {
  const payload = req.body || {};
  const incomingProfile = payload.profile || {};

  const topUpdates = {};

  if (payload.name !== undefined) {
    const name = String(payload.name ?? '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Name cannot be empty' });
    }
    topUpdates.name = name;
  }

  if (payload.email !== undefined) {
    const email = String(payload.email ?? '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'Email cannot be empty' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }
    if (email !== req.user.email) {
      const taken = await User.findOne({ email, _id: { $ne: req.user._id } })
        .select('_id')
        .lean();
      if (taken) {
        return res.status(400).json({ message: 'That email is already in use' });
      }
    }
    topUpdates.email = email;
  }

  if (payload.phoneNumber !== undefined) {
    const newPhone = String(payload.phoneNumber ?? '').trim();
    topUpdates.phoneNumber = newPhone;
    const oldPhone = String(req.user.phoneNumber ?? '').trim();
    const oldWa = String(req.user.whatsappNumber ?? '').trim();
    if (!oldWa || oldWa === oldPhone) {
      topUpdates.whatsappNumber = newPhone;
    }
  }

  let avatar = incomingProfile.avatar ?? req.user.profile?.avatar ?? null;
  if (incomingProfile.avatar && incomingProfile.avatar.startsWith('data:')) {
    const oldAvatar = req.user.profile?.avatar;
    avatar = await uploadIfBase64(incomingProfile.avatar, 'interovert/avatars');
    if (oldAvatar?.includes('cloudinary.com') && avatar !== oldAvatar) {
      cloudinaryDelete(oldAvatar).catch(() => {});
    }
  }

  let gender = req.user.profile?.gender ?? '';
  if (incomingProfile.gender !== undefined) {
    const rawGender = String(incomingProfile.gender ?? '').trim().toLowerCase();
    gender = ['male', 'female', ''].includes(rawGender) ? rawGender : gender;
  }

  const updates = {
    ...topUpdates,
    profile: {
      avatar,
      gender,
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
