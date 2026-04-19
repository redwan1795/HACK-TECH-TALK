import { Router } from 'express';
import { z } from 'zod';
import * as AuthService from '../../services/AuthService';
import { authenticate } from '../middlewares/authenticate';
import { authLimiter } from '../middlewares/rateLimiter';
import { HttpError } from '../middlewares/errorHandler';

export const authRouter = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['producer_home', 'producer_farmer', 'consumer', 'broker']),
  displayName: z.string().min(1).max(100).optional(),
  locationZip: z.string().regex(/^\d{5}$/).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

authRouter.post('/register', authLimiter, async (req, res, next) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    const result = await AuthService.register(parsed.data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', authLimiter, async (req, res, next) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Email and password required');
    }
    const result = await AuthService.login(parsed.data.email, parsed.data.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const parsed = RefreshSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'refreshToken required');
    }
    const result = await AuthService.refresh(parsed.data.refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (refreshToken) AuthService.logout(refreshToken);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me — return current user info
authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});
