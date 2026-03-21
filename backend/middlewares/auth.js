import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import env from '../config/env.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: token missing' });
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.userId).select('-password -otp -otpExpiry');

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: invalid token user' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: invalid token' });
  }
}

/** Sets req.user when a valid Bearer token is present; otherwise continues without error. */
export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next();

    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.userId).select('-password -otp -otpExpiry');
    if (user) req.user = user;
  } catch {
    /* invalid or expired token — treat as anonymous */
  }
  next();
}
