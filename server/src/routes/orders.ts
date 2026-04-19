import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import Stripe from 'stripe';
import { query as dbQuery, withClient } from '../db/client';
import { authenticate } from '../middleware/authenticate';
import { env } from '../config/env';

const router = Router();

function isDemoMode(): boolean {
  return !env.stripeSecretKey || env.stripeSecretKey.includes('placeholder');
}

function getStripe(): InstanceType<typeof Stripe> {
  return new Stripe(env.stripeSecretKey);
}

// ── POST /orders — create order + Stripe PaymentIntent ───────────────────────
router.post(
  '/',
  authenticate,
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.listingId').isUUID().withMessage('each item.listingId must be a UUID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('each item.quantity must be ≥ 1'),
  body('delivery_address').optional().trim(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const items = req.body.items as { listingId: string; quantity: number }[];
      const listingIds = items.map((i) => i.listingId);

      const { rows: listings } = await dbQuery(
        `SELECT id, title, price_cents, quantity_available, is_available
         FROM listings WHERE id = ANY($1::uuid[])`,
        [listingIds]
      );

      const stockErrors: { listingId: string; message: string }[] = [];
      for (const item of items) {
        const listing = listings.find((l: any) => l.id === item.listingId);
        if (!listing || !listing.is_available) {
          stockErrors.push({ listingId: item.listingId, message: 'Listing not available' });
          continue;
        }
        if (listing.price_cents == null) {
          stockErrors.push({ listingId: item.listingId, message: 'Listing has no price' });
          continue;
        }
        if (listing.quantity_available < item.quantity) {
          stockErrors.push({
            listingId: item.listingId,
            message: `Only ${listing.quantity_available} available`,
          });
        }
      }

      if (stockErrors.length > 0) {
        res.status(409).json({ error: { code: 'INSUFFICIENT_STOCK', details: stockErrors } });
        return;
      }

      // Compute totals in cents
      let subtotalCents = 0;
      for (const item of items) {
        const listing = listings.find((l: any) => l.id === item.listingId);
        subtotalCents += listing.price_cents * item.quantity;
      }

      const { rows: configRows } = await dbQuery(
        `SELECT value FROM platform_config WHERE key = 'fee_percent'`
      );
      const feePercent = configRows.length > 0 ? parseFloat(configRows[0].value) : 7;
      const platformFeeCents = Math.round(subtotalCents * feePercent / 100);
      const totalCents = subtotalCents + platformFeeCents;

      // Demo mode: skip Stripe, create order as paid immediately
      if (isDemoMode()) {
        const { rows: orderRows } = await dbQuery(
          `INSERT INTO orders
             (consumer_id, subtotal_cents, fee_percent, platform_fee_cents, total_cents, stripe_payment_intent_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'paid')
           RETURNING id`,
          [req.user!.sub, subtotalCents, feePercent, platformFeeCents, totalCents, 'demo_mode']
        );
        const orderId = orderRows[0].id as string;

        for (const item of items) {
          const listing = listings.find((l: any) => l.id === item.listingId);
          await dbQuery(
            `INSERT INTO order_items (order_id, listing_id, quantity, unit_price_cents)
             VALUES ($1, $2, $3, $4)`,
            [orderId, item.listingId, item.quantity, listing.price_cents]
          );
          await dbQuery(
            `UPDATE listings SET quantity_available = quantity_available - $1 WHERE id = $2`,
            [item.quantity, item.listingId]
          );
        }

        res.status(201).json({
          orderId,
          subtotalCents,
          feePercent,
          platformFeeCents,
          totalCents,
          stripeClientSecret: 'demo_mode',
        });
        return;
      }

      // Create Stripe PaymentIntent
      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: 'usd',
        metadata: { consumer_id: req.user!.sub },
      });

      // Insert order + items
      const { rows: orderRows } = await dbQuery(
        `INSERT INTO orders
           (consumer_id, subtotal_cents, fee_percent, platform_fee_cents, total_cents, stripe_payment_intent_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [req.user!.sub, subtotalCents, feePercent, platformFeeCents, totalCents, paymentIntent.id]
      );
      const orderId = orderRows[0].id as string;

      for (const item of items) {
        const listing = listings.find((l: any) => l.id === item.listingId);
        await dbQuery(
          `INSERT INTO order_items (order_id, listing_id, quantity, unit_price_cents)
           VALUES ($1, $2, $3, $4)`,
          [orderId, item.listingId, item.quantity, listing.price_cents]
        );
      }

      res.status(201).json({
        orderId,
        subtotalCents,
        feePercent,
        platformFeeCents,
        totalCents,
        stripeClientSecret: paymentIntent.client_secret,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /orders/:id/confirm — verify payment + mark paid + decrement stock ───
router.post(
  '/:id/confirm',
  authenticate,
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const { rows: orderRows } = await dbQuery(
        `SELECT id, consumer_id, status, stripe_payment_intent_id FROM orders WHERE id = $1`,
        [req.params.id]
      );
      if (orderRows.length === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
        return;
      }
      const order = orderRows[0] as {
        id: string; consumer_id: string; status: string; stripe_payment_intent_id: string;
      };

      if (order.consumer_id !== req.user!.sub && req.user!.role !== 'admin') {
        res.status(403).json({ error: { code: 'FORBIDDEN' } });
        return;
      }

      if (order.status === 'paid') {
        const full = await getFullOrder(req.params.id);
        res.json(full);
        return;
      }

      // Demo mode orders are already paid at creation
      if (order.stripe_payment_intent_id === 'demo_mode') {
        await dbQuery(`UPDATE orders SET status = 'paid' WHERE id = $1`, [req.params.id]);
        const full = await getFullOrder(req.params.id);
        res.json(full);
        return;
      }

      const stripe = getStripe();
      const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
      if (pi.status !== 'succeeded') {
        res.status(402).json({
          error: { code: 'PAYMENT_NOT_CONFIRMED', message: 'Payment has not succeeded.' },
        });
        return;
      }

      await withClient(async (client) => {
        await client.query('BEGIN');
        await client.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [req.params.id]);
        const { rows: items } = await client.query(
          `SELECT listing_id, quantity FROM order_items WHERE order_id = $1`,
          [req.params.id]
        );
        for (const item of items) {
          await client.query(
            `UPDATE listings SET quantity_available = quantity_available - $1 WHERE id = $2`,
            [item.quantity, item.listing_id]
          );
        }
        await client.query('COMMIT');
      });

      const full = await getFullOrder(req.params.id);
      res.json(full);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /orders — list (consumer: own; admin: all) ────────────────────────────
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isAdmin = req.user!.role === 'admin';
      const whereClause = isAdmin ? '' : 'WHERE o.consumer_id = $1';
      const values = isAdmin ? [] : [req.user!.sub];

      const { rows } = await dbQuery(
        `SELECT o.id, o.consumer_id, o.status,
                o.subtotal_cents, o.fee_percent, o.platform_fee_cents, o.total_cents,
                o.stripe_payment_intent_id, o.created_at,
                COALESCE(
                  json_agg(json_build_object(
                    'id', oi.id,
                    'listing_id', oi.listing_id,
                    'quantity', oi.quantity,
                    'unit_price_cents', oi.unit_price_cents
                  )) FILTER (WHERE oi.id IS NOT NULL),
                  '[]'
                ) AS items
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         ${whereClause}
         GROUP BY o.id
         ORDER BY o.created_at DESC`,
        values
      );
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /orders/:id — single order ───────────────────────────────────────────
router.get(
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
      const full = await getFullOrder(req.params.id);
      if (!full) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      if (full.consumer_id !== req.user!.sub && req.user!.role !== 'admin') {
        res.status(403).json({ error: { code: 'FORBIDDEN' } });
        return;
      }
      res.json(full);
    } catch (err) {
      next(err);
    }
  }
);

async function getFullOrder(orderId: string) {
  const { rows } = await dbQuery(
    `SELECT o.id, o.consumer_id, o.status,
            o.subtotal_cents, o.fee_percent, o.platform_fee_cents, o.total_cents,
            o.stripe_payment_intent_id, o.created_at,
            COALESCE(
              json_agg(json_build_object(
                'id', oi.id,
                'listing_id', oi.listing_id,
                'quantity', oi.quantity,
                'unit_price_cents', oi.unit_price_cents
              )) FILTER (WHERE oi.id IS NOT NULL),
              '[]'
            ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = $1
     GROUP BY o.id`,
    [orderId]
  );
  return rows[0] ?? null;
}

export default router;
