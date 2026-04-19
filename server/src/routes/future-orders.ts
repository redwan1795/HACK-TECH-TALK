import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db/client';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// ── POST /future-orders — save confirmed demand ───────────────────────────────
router.post(
  '/',
  authenticate,
  body('product_query').notEmpty().trim().withMessage('product_query is required'),
  body('product_keyword').notEmpty().trim().withMessage('product_keyword is required'),
  body('quantity_needed').isFloat({ min: 0.01 }).withMessage('quantity_needed must be > 0'),
  body('unit').notEmpty().trim().withMessage('unit is required'),
  body('zip').isPostalCode('US').withMessage('zip must be a valid US postal code'),
  body('needed_by_date').optional().isISO8601().withMessage('needed_by_date must be ISO 8601'),
  body('max_price_cents').optional().isInt({ min: 0 }).withMessage('max_price_cents must be a non-negative integer'),
  body('proximity_miles').optional().isInt({ min: 1, max: 500 }).toInt(),
  body('expires_at').isISO8601().withMessage('expires_at must be ISO 8601'),
  body('category').optional().isIn(['vegetable', 'fruit', 'flower', 'egg', 'other']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const expiresAt = new Date(req.body.expires_at as string);
      if (expiresAt <= new Date()) {
        res.status(400).json({ error: { code: 'INVALID_EXPIRY', message: 'expires_at must be in the future' } });
        return;
      }

      const {
        product_query, product_keyword, quantity_needed, unit,
        zip, needed_by_date, max_price_cents, proximity_miles, category,
      } = req.body as {
        product_query: string; product_keyword: string; quantity_needed: number;
        unit: string; zip: string; needed_by_date?: string; max_price_cents?: number;
        proximity_miles?: number; category?: string;
      };

      const { rows } = await query(
        `INSERT INTO future_orders
           (consumer_id, product_query, product_keyword, category, quantity_needed,
            unit, max_price_cents, proximity_miles, zip, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          req.user!.sub,
          product_query,
          product_keyword.toLowerCase().trim(),
          category ?? null,
          quantity_needed,
          unit,
          max_price_cents ?? null,
          proximity_miles ?? 25,
          zip,
          expiresAt.toISOString(),
        ]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /future-orders — list own demands ────────────────────────────────────
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { rows } = await query(
        `SELECT * FROM future_orders
         WHERE consumer_id = $1
         ORDER BY created_at DESC`,
        [req.user!.sub]
      );
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /future-orders/:id — cancel demand ────────────────────────────────
router.delete(
  '/:id',
  authenticate,
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const { rows } = await query(
        'SELECT consumer_id FROM future_orders WHERE id = $1',
        [req.params.id]
      );
      if (rows.length === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Future order not found' } });
        return;
      }
      if (rows[0].consumer_id !== req.user!.sub) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not own this future order' } });
        return;
      }
      const { rows: updated } = await query(
        `UPDATE future_orders SET status = 'cancelled' WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      res.json(updated[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
