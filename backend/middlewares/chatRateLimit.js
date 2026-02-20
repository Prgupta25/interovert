import rateLimit from 'express-rate-limit';

export const chatMessageRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many messages sent. Please slow down.' },
});
