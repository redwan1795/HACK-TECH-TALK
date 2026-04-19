import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/client';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

const stub501 = (_req: Request, res: Response): void => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in a future milestone' } });
};

// GET /api/v1/listings — public browse, no auth required
router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await query(`
      SELECT id, title, description, category,
             price_cents, quantity_available,
             location_zip, images, is_available, created_at
      FROM   listings
      WHERE  is_available = TRUE
      ORDER  BY created_at DESC
    `);
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
});

// Write endpoints: auth-gated (logic comes in M2, stubs return 501 for now)
router.post('/', authenticate, authorize('producer', 'broker', 'admin'), stub501);
router.get('/:id', stub501);
router.put('/:id', authenticate, authorize('producer', 'broker', 'admin'), stub501);
router.delete('/:id', authenticate, authorize('producer', 'broker', 'admin'), stub501);
router.patch('/:id/publish', authenticate, authorize('producer', 'broker', 'admin'), stub501);

export default router;
