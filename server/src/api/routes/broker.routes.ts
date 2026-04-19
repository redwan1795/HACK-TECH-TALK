import { Router } from 'express';
import { pool } from '../../db/pool';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

export const brokerRouter = Router();

// GET /api/v1/broker/aggregate
// Returns listings grouped by producer — a simple "multi-producer basket"
// building block for M5 stub.
brokerRouter.get('/aggregate', authenticate, authorize('broker'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id AS producer_id, u.display_name AS producer_name,
        u.location_zip AS producer_zip, u.licensed,
        COUNT(l.id)::int AS listing_count,
        COALESCE(SUM(l.quantity_available), 0)::int AS total_quantity,
        COALESCE(MIN(l.price_cents), 0)::int AS min_price_cents,
        COALESCE(MAX(l.price_cents), 0)::int AS max_price_cents,
        ARRAY_AGG(
          json_build_object(
            'id', l.id,
            'title', l.title,
            'category', l.category,
            'priceCents', l.price_cents,
            'unit', l.unit,
            'quantityAvailable', l.quantity_available
          ) ORDER BY l.created_at DESC
        ) FILTER (WHERE l.id IS NOT NULL) AS listings
      FROM users u
      LEFT JOIN listings l ON l.producer_id = u.id AND l.is_available = TRUE AND l.price_cents IS NOT NULL
      WHERE u.role IN ('producer_home', 'producer_farmer')
      GROUP BY u.id, u.display_name, u.location_zip, u.licensed
      HAVING COUNT(l.id) > 0
      ORDER BY listing_count DESC
    `);
    res.json({ producers: rows });
  } catch (err) { next(err); }
});
