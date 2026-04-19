import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import Stripe from 'stripe';
import { query } from '../db/client';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { env } from '../config/env';

const router = Router();

function isDemoMode(): boolean {
  return !env.stripeSecretKey || env.stripeSecretKey.includes('placeholder');
}

function getStripe(): InstanceType<typeof Stripe> {
  return new Stripe(env.stripeSecretKey);
}

// POST /subscriptions — create recurring subscription
router.post(
  '/',
  authenticate,
  authorize('consumer'),
  body('listing_id').isUUID().withMessage('listing_id must be a valid UUID'),
  body('cadence').isIn(['weekly', 'biweekly', 'monthly']).withMessage('cadence must be weekly, biweekly, or monthly'),
  body('quantity').isFloat({ min: 0.01 }).withMessage('quantity must be > 0'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const { listing_id, cadence, quantity } = req.body as {
        listing_id: string;
        cadence: 'weekly' | 'biweekly' | 'monthly';
        quantity: number;
      };

      const { rows: listings } = await query(
        `SELECT id, title, price_cents, is_available FROM listings WHERE id = $1`,
        [listing_id]
      );
      if (listings.length === 0 || !listings[0].is_available) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Listing not found or unavailable' } });
        return;
      }

      const listing = listings[0] as { id: string; title: string; price_cents: number; is_available: boolean };

      const intervalMap: Record<string, 'week' | 'month'> = {
        weekly: 'week',
        biweekly: 'week',
        monthly: 'month',
      };
      const intervalCountMap: Record<string, number> = {
        weekly: 1,
        biweekly: 2,
        monthly: 1,
      };

      let stripeSubId: string | null = null;

      if (!isDemoMode() && listing.price_cents) {
        try {
          const stripe = getStripe();
          const unitAmount = Math.round(listing.price_cents * quantity);
          const stripeSub = await stripe.subscriptions.create({
            customer: req.user!.sub,
            items: [{
              price_data: {
                currency: 'usd',
                unit_amount: unitAmount,
                recurring: {
                  interval: intervalMap[cadence],
                  interval_count: intervalCountMap[cadence],
                },
                product_data: { name: listing.title },
              },
            }],
          } as any);
          stripeSubId = stripeSub.id;
        } catch (stripeErr) {
          console.error('[subscriptions] Stripe error:', stripeErr);
          res.status(502).json({ error: { code: 'STRIPE_ERROR', message: 'Failed to create Stripe subscription' } });
          return;
        }
      }

      const { rows } = await query(
        `INSERT INTO subscriptions (consumer_id, listing_id, cadence, status, stripe_sub_id)
         VALUES ($1, $2, $3, 'active', $4)
         RETURNING *`,
        [req.user!.sub, listing_id, cadence, stripeSubId]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// GET /subscriptions — list own subscriptions
router.get(
  '/',
  authenticate,
  authorize('consumer'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { rows } = await query(
        `SELECT s.*, l.title AS listing_title, l.price_cents AS listing_price_cents
         FROM subscriptions s
         JOIN listings l ON l.id = s.listing_id
         WHERE s.consumer_id = $1
         ORDER BY s.created_at DESC`,
        [req.user!.sub]
      );
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /subscriptions/:id — cancel subscription
router.delete(
  '/:id',
  authenticate,
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const { rows } = await query(
        `SELECT * FROM subscriptions WHERE id = $1`,
        [req.params.id]
      );
      if (rows.length === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
        return;
      }
      const sub = rows[0] as { consumer_id: string; stripe_sub_id: string | null; status: string };
      if (sub.consumer_id !== req.user!.sub && req.user!.role !== 'admin') {
        res.status(403).json({ error: { code: 'FORBIDDEN' } });
        return;
      }

      if (sub.stripe_sub_id && !isDemoMode()) {
        try {
          const stripe = getStripe();
          await stripe.subscriptions.cancel(sub.stripe_sub_id);
        } catch (stripeErr) {
          console.error('[subscriptions] Stripe cancel error:', stripeErr);
        }
      }

      const { rows: updated } = await query(
        `UPDATE subscriptions SET status = 'cancelled' WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      res.json(updated[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
