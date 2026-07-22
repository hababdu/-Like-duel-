// src/middleware/rateLimit.js
import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 100,
  message: {
    success: false,
    message: "Juda ko'p so'rov yubordingiz. Biroz kutib turing."
  },
  standardHeaders: true,
  legacyHeaders: false
});