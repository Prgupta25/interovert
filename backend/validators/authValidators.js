function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function validateSignup(req, res, next) {
  const { name, email, password, phoneNumber } = req.body || {};
  if (!name || !email || !password || !phoneNumber) {
    return res.status(400).json({
      message: 'Missing required fields',
      required: ['name', 'email', 'password', 'phoneNumber'],
    });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  next();
}

export function validateLogin(req, res, next) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  next();
}

export function validateVerifyOtp(req, res, next) {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }
  next();
}

export function validateForgotPassword(req, res, next) {
  const { email } = req.body || {};
  if (!email || !isEmail(email)) {
    return res.status(400).json({ message: 'A valid email address is required' });
  }
  next();
}

export function validateResetPassword(req, res, next) {
  const { email, token, password } = req.body || {};
  if (!email || !isEmail(email)) {
    return res.status(400).json({ message: 'A valid email address is required' });
  }
  if (!token || String(token).length < 10) {
    return res.status(400).json({ message: 'Reset token is missing or invalid' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }
  next();
}
