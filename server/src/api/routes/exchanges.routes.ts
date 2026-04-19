import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool';
import { authenticate } from '../middlewares/authenticate';
import { HttpError } from '../middlewares/errorHandler';

export const exchangesRouter = Router();

// GET /api/v1/exchanges — my exchanges (either as initiator or as listing owner)
exchangesRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, l.title AS listing_title, l.producer_id, u.display_name AS initiator_name
       FROM exchanges e
       JOIN listings l ON l.id = e.listing_id
       JOIN users u ON u.id = e.initiator_id
       WHERE e.initiator_id = $1 OR l.producer_id = $1
       ORDER BY e.created_at DESC LIMIT 50`,
      [req.user!.id]
    );
    res.json({
      exchanges: rows.map((r) => ({
        id: r.id,
        listingId: r.listing_id,
        listingTitle: r.listing_title,
        initiatorId: r.initiator_id,
        initiatorName: r.initiator_name,
        offeredItem: r.offered_item,
        status: r.status,
        createdAt: r.created_at,
        isOwner: r.producer_id === req.user!.id,
      })),
    });
  } catch (err) { next(err); }
});

const CreateSchema = z.object({
  listingId: z.string().uuid(),
  offeredItem: z.string().min(2).max(200),
});

// POST /api/v1/exchanges — propose an exchange
exchangesRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }

    const { rows: lrows } = await pool.query(
      `SELECT producer_id, price_cents, is_available FROM listings WHERE id = $1`,
      [parsed.data.listingId]
    );
    if (lrows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Listing not found');
    if (!lrows[0].is_available) throw new HttpError(400, 'UNAVAILABLE', 'Listing is unavailable');
    if (lrows[0].producer_id === req.user!.id) {
      throw new HttpError(400, 'SELF_EXCHANGE', "Can't exchange with yourself");
    }

    const { rows } = await pool.query(
      `INSERT INTO exchanges (initiator_id, listing_id, offered_item, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, created_at`,
      [req.user!.id, parsed.data.listingId, parsed.data.offeredItem]
    );

    res.status(201).json({
      exchange: {
        id: rows[0].id,
        listingId: parsed.data.listingId,
        offeredItem: parsed.data.offeredItem,
        status: 'pending',
        createdAt: rows[0].created_at,
      },
    });
  } catch (err) { next(err); }
});

// PATCH /api/v1/exchanges/:id/status — owner accepts or declines
const StatusSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

exchangesRouter.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const parsed = StatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    }

    const { rows } = await pool.query(
      `SELECT e.*, l.producer_id FROM exchanges e
       JOIN listings l ON l.id = e.listing_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Exchange not found');
    if (rows[0].producer_id !== req.user!.id) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the listing owner can accept/decline');
    }
    if (rows[0].status !== 'pending') {
      throw new HttpError(400, 'NOT_PENDING', `Already ${rows[0].status}`);
    }

    await pool.query(
      `UPDATE exchanges SET status = $1 WHERE id = $2`,
      [parsed.data.status, req.params.id]
    );
    res.json({ ok: true, status: parsed.data.status });
  } catch (err) { next(err); }
});
