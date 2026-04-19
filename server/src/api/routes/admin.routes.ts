import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { HttpError } from '../middlewares/errorHandler';

export const adminRouter = Router();

// ---- GET /api/v1/admin/config ----
adminRouter.get('/config', authenticate, authorize('operator'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT key, value, updated_at FROM platform_config ORDER BY key`);
    res.json({ config: rows });
  } catch (err) { next(err); }
});

// ---- PATCH /api/v1/admin/config ----
const PatchSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(0).max(500),
});

adminRouter.patch('/config', authenticate, authorize('operator'), async (req, res, next) => {
  try {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }
    const { key, value } = parsed.data;

    // Validation for known keys
    if (key === 'fee_percent') {
      const num = parseFloat(value);
      if (!Number.isFinite(num) || num < 0 || num > 30) {
        throw new HttpError(400, 'INVALID_FEE', 'Fee must be a number between 0 and 30');
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO platform_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING key, value, updated_at`,
      [key, value]
    );

    res.json({ config: rows[0] });
  } catch (err) { next(err); }
});

// ---- GET /api/v1/admin/stats ----
adminRouter.get('/stats', authenticate, authorize('operator'), async (_req, res, next) => {
  try {
    const [usersRes, listingsRes, ordersRes, feesRes, foRes] = await Promise.all([
      pool.query(`
        SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY role
      `),
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_available)::int AS active,
          COUNT(*) FILTER (WHERE NOT is_available)::int AS inactive
        FROM listings
      `),
      pool.query(`
        SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total_cents), 0)::int AS revenue_cents
        FROM orders GROUP BY status ORDER BY status
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_orders,
          COALESCE(SUM(platform_fee_cents) FILTER (WHERE status = 'paid'), 0)::int AS total_fees_cents
        FROM orders
      `),
      pool.query(`
        SELECT status, COUNT(*)::int AS count FROM future_orders GROUP BY status ORDER BY status
      `),
    ]);

    res.json({
      usersByRole:     usersRes.rows,
      listings:        listingsRes.rows[0],
      ordersByStatus:  ordersRes.rows,
      fees:            feesRes.rows[0],
      futureOrdersByStatus: foRes.rows,
    });
  } catch (err) { next(err); }
});
