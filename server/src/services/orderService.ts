import { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { HttpError } from '../api/middlewares/errorHandler';
import { computeFee } from './feeService';

export interface CartItem {
  listingId: string;
  quantity: number;
}

export interface OrderSummary {
  orderId: string;
  status: string;
  subtotalCents: number;
  platformFeeCents: number;
  totalCents: number;
  feePercent: number;
  items: Array<{
    listingId: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
  paymentRef: string | null;
  createdAt: string;
}

// POST /orders — creates a pending order + computes fee + reserves stock.
export async function createOrder(consumerId: string, items: CartItem[]): Promise<OrderSummary> {
  if (!items || items.length === 0) {
    throw new HttpError(400, 'EMPTY_CART', 'Cart is empty');
  }

  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the listings we care about (FOR UPDATE to prevent race)
    const listingIds = items.map((i) => i.listingId);
    const { rows: listings } = await client.query(
      `SELECT id, title, price_cents, quantity_available, is_available
       FROM listings WHERE id = ANY($1::uuid[]) FOR UPDATE`,
      [listingIds]
    );

    if (listings.length !== items.length) {
      throw new HttpError(400, 'LISTING_NOT_FOUND', 'One or more items are no longer available');
    }

    // Validate stock + availability + compute subtotal
    const lineItems: OrderSummary['items'] = [];
    let subtotalCents = 0;

    for (const item of items) {
      const l = listings.find((r) => r.id === item.listingId);
      if (!l) throw new HttpError(400, 'LISTING_NOT_FOUND', 'Item not found');
      if (!l.is_available) throw new HttpError(400, 'LISTING_UNAVAILABLE', `${l.title} is no longer available`);
      if (l.price_cents === null) throw new HttpError(400, 'EXCHANGE_ONLY', `${l.title} is exchange-only`);
      if (item.quantity < 1) throw new HttpError(400, 'INVALID_QUANTITY', 'Quantity must be >= 1');
      if (l.quantity_available < item.quantity) {
        throw new HttpError(409, 'INSUFFICIENT_STOCK',
          `Only ${l.quantity_available} of ${l.title} available`);
      }
      const lineTotal = l.price_cents * item.quantity;
      subtotalCents += lineTotal;
      lineItems.push({
        listingId: l.id,
        title: l.title,
        quantity: item.quantity,
        unitPriceCents: l.price_cents,
        lineTotalCents: lineTotal,
      });
    }

    const fee = await computeFee(subtotalCents);

    // Insert order (status = pending)
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (consumer_id, status, subtotal_cents, platform_fee_cents, total_cents)
       VALUES ($1, 'pending', $2, $3, $4)
       RETURNING id, status, created_at`,
      [consumerId, fee.subtotalCents, fee.platformFeeCents, fee.totalCents]
    );
    const order = orderRows[0];

    // Insert items
    for (const li of lineItems) {
      await client.query(
        `INSERT INTO order_items (order_id, listing_id, quantity, unit_price_cents)
         VALUES ($1, $2, $3, $4)`,
        [order.id, li.listingId, li.quantity, li.unitPriceCents]
      );
    }

    await client.query('COMMIT');

    return {
      orderId: order.id,
      status: order.status,
      subtotalCents: fee.subtotalCents,
      platformFeeCents: fee.platformFeeCents,
      totalCents: fee.totalCents,
      feePercent: fee.feePercent,
      items: lineItems,
      paymentRef: null,
      createdAt: order.created_at,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// POST /orders/:id/confirm — the "fake Stripe" — flips pending → paid
// and decrements listing stock.
export async function confirmOrder(orderId: string, consumerId: string): Promise<OrderSummary> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      `SELECT id, consumer_id, status, subtotal_cents, platform_fee_cents, total_cents, created_at
       FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    if (orderRows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
    const order = orderRows[0];

    if (order.consumer_id !== consumerId) {
      throw new HttpError(403, 'FORBIDDEN', 'Not your order');
    }
    if (order.status === 'paid') {
      // Idempotent — return the existing paid order
      return buildSummary(client, orderId);
    }
    if (order.status !== 'pending') {
      throw new HttpError(400, 'ORDER_NOT_PENDING', `Order is ${order.status}`);
    }

    // Lock order items' listings and decrement
    const { rows: items } = await client.query(
      `SELECT listing_id, quantity FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    for (const it of items) {
      const { rows: stock } = await client.query(
        `SELECT quantity_available FROM listings WHERE id = $1 FOR UPDATE`,
        [it.listing_id]
      );
      if (stock.length === 0 || stock[0].quantity_available < it.quantity) {
        throw new HttpError(409, 'INSUFFICIENT_STOCK', 'Stock ran out while paying');
      }
      await client.query(
        `UPDATE listings SET quantity_available = quantity_available - $1 WHERE id = $2`,
        [it.quantity, it.listing_id]
      );
    }

    // Fake payment reference
    const fakePaymentRef = `pi_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await client.query(
      `UPDATE orders SET status = 'paid', payment_ref = $1 WHERE id = $2`,
      [fakePaymentRef, orderId]
    );

    const summary = await buildSummary(client, orderId);
    await client.query('COMMIT');
    return summary;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Helper used inside a transaction
async function buildSummary(client: PoolClient, orderId: string): Promise<OrderSummary> {
  const { rows: orderRows } = await client.query(
    `SELECT o.*, (
       SELECT CASE WHEN o.subtotal_cents = 0 THEN 0
              ELSE ROUND((o.platform_fee_cents::decimal / o.subtotal_cents) * 100, 2)
              END
     ) AS fee_percent
     FROM orders o WHERE id = $1`,
    [orderId]
  );
  const o = orderRows[0];

  const { rows: items } = await client.query(
    `SELECT oi.listing_id, oi.quantity, oi.unit_price_cents, l.title
     FROM order_items oi JOIN listings l ON l.id = oi.listing_id
     WHERE oi.order_id = $1`,
    [orderId]
  );

  return {
    orderId: o.id,
    status: o.status,
    subtotalCents: o.subtotal_cents,
    platformFeeCents: o.platform_fee_cents,
    totalCents: o.total_cents,
    feePercent: Number(o.fee_percent),
    items: items.map((it: any) => ({
      listingId: it.listing_id,
      title: it.title,
      quantity: it.quantity,
      unitPriceCents: it.unit_price_cents,
      lineTotalCents: it.unit_price_cents * it.quantity,
    })),
    paymentRef: o.payment_ref,
    createdAt: o.created_at,
  };
}

export async function getOrder(orderId: string, consumerId: string): Promise<OrderSummary> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT consumer_id FROM orders WHERE id = $1`,
      [orderId]
    );
    if (rows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
    if (rows[0].consumer_id !== consumerId) throw new HttpError(403, 'FORBIDDEN', 'Not your order');
    return buildSummary(client, orderId);
  } finally {
    client.release();
  }
}

export async function listMyOrders(consumerId: string): Promise<OrderSummary[]> {
  const { rows } = await pool.query(
    `SELECT id FROM orders WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [consumerId]
  );
  const client = await pool.connect();
  try {
    const out: OrderSummary[] = [];
    for (const r of rows) out.push(await buildSummary(client, r.id));
    return out;
  } finally {
    client.release();
  }
}

// POST /orders/fee-preview — compute fee without creating order
export async function feePreview(items: CartItem[]) {
  if (!items || items.length === 0) {
    throw new HttpError(400, 'EMPTY_CART', 'Cart is empty');
  }
  const { rows: listings } = await pool.query(
    `SELECT id, title, price_cents FROM listings WHERE id = ANY($1::uuid[])`,
    [items.map((i) => i.listingId)]
  );

  let subtotal = 0;
  for (const i of items) {
    const l = listings.find((r) => r.id === i.listingId);
    if (!l || l.price_cents === null) {
      throw new HttpError(400, 'BAD_ITEM', 'Invalid item');
    }
    subtotal += l.price_cents * i.quantity;
  }
  return computeFee(subtotal);
}
