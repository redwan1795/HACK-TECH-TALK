import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../db/redis';

export const authRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
    });
  },
});

// Per-user AI search rate limit: 20 requests per hour
export async function aiRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    next();
    return;
  }
  const key = `ai_search:${userId}`;
  try {
    const current = await redisClient.get(key);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= 20) {
      res.status(429).json({
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'AI search limit: 20 requests per hour.' },
      });
      return;
    }
    await redisClient.set(key, String(count + 1), 3600);
  } catch {
    // Redis unavailable — allow the request through
  }
  next();
}
