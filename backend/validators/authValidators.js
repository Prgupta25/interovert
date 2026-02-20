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
