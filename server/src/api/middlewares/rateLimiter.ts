import rateLimit from 'express-rate-limit';

// In-memory only (no Redis). Good enough for dev + hackathon.
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  limit: 10,             // 10 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests — please slow down and try again in a minute',
    },
  },
});
