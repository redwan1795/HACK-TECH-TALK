import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { query } from '../db/client';
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../services/tokenService';
import { authRateLimiter } from '../middleware/rateLimiter';
import { authenticate } from '../middleware/authenticate';
import type { UserRole } from '@community-garden/types';

const router = Router();

// ── POST /auth/register ───────────────────────────────────────────────────────
router.post(
  '/register',
  authRateLimiter,
  body('email').isEmail().toLowerCase().trim(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('role').isIn(['consumer', 'producer', 'broker']).withMessage('Invalid role'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }

    const { email, password, name, role, locationZip } = req.body as {
      email: string; password: string; name: string;
      role: UserRole; locationZip?: string;
    };

    try {
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rowCount && existing.rowCount > 0) {
        res.status(409).json({ error: { code: 'EMAIL_IN_USE', message: 'Email already registered' } });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const { rows } = await query(
        `INSERT INTO users (email, password_hash, name, role, location_zip)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, role,
                   location_zip  AS "locationZip",
                   licensed,
                   created_at    AS "createdAt"`,
        [email, passwordHash, name, role, locationZip ?? null]
      );
      const user = rows[0];

      const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
      const refreshToken = await issueRefreshToken(user.id);

      res.status(201).json({ accessToken, refreshToken, user });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post(
  '/login',
  authRateLimiter,
  body('email').isEmail().toLowerCase().trim(),
  body('password').notEmpty().withMessage('Password is required'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }

    const { email, password } = req.body as { email: string; password: string };

    try {
      const { rows } = await query(
        `SELECT id, email, password_hash, name, role,
                location_zip AS "locationZip", licensed,
                created_at   AS "createdAt"
         FROM users WHERE email = $1`,
        [email]
      );
      if (rows.length === 0) {
        res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        return;
      }

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        return;
      }

      const { password_hash: _omit, ...safeUser } = user;
      const accessToken = signAccessToken({ sub: safeUser.id, email: safeUser.email, role: safeUser.role });
      const refreshToken = await issueRefreshToken(safeUser.id);

      res.json({ accessToken, refreshToken, user: safeUser });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /auth/refresh ────────────────────────────────────────────────────────
router.post('/refresh', authRateLimiter, async (req, res, next) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'refreshToken is required' } });
    return;
  }
  try {
    const result = await rotateRefreshToken(refreshToken);
    if (!result) {
      res.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Token is invalid or expired' } });
      return;
    }
    const { rows } = await query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [result.userId]
    );
    if (rows.length === 0) {
      res.status(401).json({ error: { code: 'USER_NOT_FOUND' } });
      return;
    }
    const user = rows[0];
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    res.json({ accessToken, refreshToken: result.newRefreshToken });
  } catch (err) {
    next(err);
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  try {
    if (refreshToken) await revokeRefreshToken(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
