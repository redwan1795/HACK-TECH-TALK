import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/client';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// GET /admin/config — read platform fee (any authenticated user)
router.get(
  '/config',
  authenticate,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { rows } = await query(
        `SELECT value FROM platform_config WHERE key = 'fee_percent'`
      );
      const feePercent = rows.length > 0 ? parseFloat(rows[0].value) : 7;
      res.json({ fee_percent: feePercent });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/config — update platform fee (admin only)
router.patch(
  '/config',
  authenticate,
  authorize('admin'),
  body('fee_percent').isFloat({ min: 0, max: 100 }).withMessage('fee_percent must be between 0 and 100'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const feePercent = parseFloat(req.body.fee_percent);
      await query(
        `INSERT INTO platform_config (key, value)
         VALUES ('fee_percent', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [feePercent.toString()]
      );
      res.json({ fee_percent: feePercent });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
