import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/client';
import { authenticate } from '../middleware/authenticate';

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

export default router;
