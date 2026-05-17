const rateLimit = require('express-rate-limit');

// General API rate limit: 200 req/15min per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth routes: 10 attempts/15min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Upload limiter: 20 uploads/hour
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Upload limit reached. Max 20 uploads per hour.' },
});

// OTP limiter: 5 OTP requests per 15 minutes per IP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset attempts. Please try again in 15 minutes.' },
});

module.exports = { apiLimiter, authLimiter, uploadLimiter, otpLimiter };
