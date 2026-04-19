import { pool } from '../db/pool';
import { HttpError } from '../api/middlewares/errorHandler';
import { haversineMiles } from '../utils/haversine';
import { lookupZip } from './geocodeService';
import { pushNotification } from './notificationService';

export interface CreateFutureOrderInput {
  productQuery: string;          // e.g. "oranges" — used for keyword matching too
  category?: string;             // enum value (optional — widens matching)
  quantityNeeded: number;
  proximityMiles: number;
  daysUntilExpiry: number;       // 1–30
  locationZip?: string;          // defaults to user's ZIP if absent
}

export interface FutureOrder {
  id: string;
  consumerId: string;
  productQuery: string;
  category: string | null;
  quantityNeeded: number;
  proximityMiles: number;
  expiresAt: string;
  status: string;
  matchedListingId: string | null;
  locationZip: string | null;
  createdAt: string;
}

function mapRow(r: any): FutureOrder {
  return {
    id: r.id,
    consumerId: r.consumer_id,
    productQuery: r.product_query,
    category: r.category,
    quantityNeeded: r.quantity_needed,
    proximityMiles: r.proximity_miles,
    expiresAt: r.expires_at,
    status: r.status,
    matchedListingId: r.matched_listing_id,
    locationZip: r.location_zip ?? null,
    createdAt: r.created_at,
  };
}

export async function createFutureOrder(
  consumerId: string,
  input: CreateFutureOrderInput
): Promise<FutureOrder> {
  if (!input.productQuery || input.productQuery.trim().length < 2) {
    throw new HttpError(400, 'BAD_QUERY', 'Product description is required');
  }
  if (input.daysUntilExpiry < 1 || input.daysUntilExpiry > 30) {
    throw new HttpError(400, 'BAD_EXPIRY', 'Expiry must be 1–30 days');
  }

  // Resolve ZIP — prefer provided, else consumer's profile ZIP
  let zip = input.locationZip?.trim();
  if (!zip) {
    const { rows } = await pool.query(
      `SELECT location_zip FROM users WHERE id = $1`,
      [consumerId]
    );
    zip = rows[0]?.location_zip ?? undefined;
  }
  if (!zip) {
    throw new HttpError(400, 'MISSING_ZIP', 'A ZIP is required (on profile or in form)');
  }

  const expiresAt = new Date(Date.now() + input.daysUntilExpiry * 24 * 60 * 60 * 1000);

  // NOTE: future_orders table doesn't have location_zip/lat/lng columns in
  // the M0 schema, so we'll look up the consumer's ZIP on the fly when
  // matching. Store productQuery verbatim.
  const { rows } = await pool.query(
    `INSERT INTO future_orders
       (consumer_id, product_query, category, quantity_needed, proximity_miles, expires_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'open')
     RETURNING *`,
    [
      consumerId,
      input.productQuery.trim(),
      input.category ?? null,
      input.quantityNeeded,
      input.proximityMiles,
      expiresAt,
    ]
  );

  // Attach zip to the response shape for convenience (not persisted here,
  // but we keep it in the user record).
  return { ...mapRow(rows[0]), locationZip: zip };
}

export async function listMyFutureOrders(consumerId: string): Promise<FutureOrder[]> {
  const { rows } = await pool.query(
    `SELECT fo.*, u.location_zip
     FROM future_orders fo
     JOIN users u ON u.id = fo.consumer_id
     WHERE fo.consumer_id = $1
     ORDER BY fo.created_at DESC
     LIMIT 100`,
    [consumerId]
  );
  return rows.map(mapRow);
}

export async function cancelFutureOrder(consumerId: string, id: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT consumer_id, status FROM future_orders WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Future order not found');
  if (rows[0].consumer_id !== consumerId) {
    throw new HttpError(403, 'FORBIDDEN', 'Not your demand signal');
  }
  if (rows[0].status !== 'open') {
    throw new HttpError(400, 'NOT_OPEN', `Cannot cancel — status is ${rows[0].status}`);
  }
  await pool.query(`UPDATE future_orders SET status = 'cancelled' WHERE id = $1`, [id]);
}

// ---------------------------------------------------------------------
// Matching — called after a listing is published.
// ---------------------------------------------------------------------
export async function runMatchingForListing(listingId: string): Promise<number> {
  // Load the listing
  const { rows: lrows } = await pool.query(
    `SELECT id, title, description, category, location_lat, location_lng, location_zip,
            producer_id, (SELECT display_name FROM users WHERE id = listings.producer_id) AS producer_name
     FROM listings
     WHERE id = $1 AND is_available = TRUE`,
    [listingId]
  );
  if (lrows.length === 0) return 0;
  const listing = lrows[0];

  // Find open future_orders that match this listing's category
  // (or have no category specified) AND haven't expired.
  const { rows: candidates } = await pool.query(
    `SELECT fo.*, u.location_zip AS consumer_zip
     FROM future_orders fo
     JOIN users u ON u.id = fo.consumer_id
     WHERE fo.status = 'open'
       AND fo.expires_at > NOW()
       AND (fo.category IS NULL OR fo.category = $1)`,
    [listing.category]
  );

  const listingText = `${listing.title} ${listing.description ?? ''}`.toLowerCase();
  let matchCount = 0;

  for (const fo of candidates) {
    // 1. Keyword match — require at least one word from product_query
    //    to appear in the listing title or description.
    const words = fo.product_query
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length >= 3); // ignore stop words like "a", "to"
    if (words.length > 0) {
      const anyMatch = words.some((w: string) => listingText.includes(w));
      if (!anyMatch) continue;
    }

    // 2. Proximity match — geocode consumer ZIP (cached) and compare.
    if (!fo.consumer_zip || listing.location_lat == null || listing.location_lng == null) {
      continue;
    }
    const consumerGeo = await lookupZip(fo.consumer_zip);
    if (!consumerGeo) continue;

    const distance = haversineMiles(
      consumerGeo.lat, consumerGeo.lng,
      Number(listing.location_lat), Number(listing.location_lng)
    );
    if (distance > fo.proximity_miles) continue;

    // 3. It's a match — update the future order + push notification.
    await pool.query(
      `UPDATE future_orders
       SET status = 'matched', matched_listing_id = $1
       WHERE id = $2`,
      [listing.id, fo.id]
    );

    pushNotification({
      userId: fo.consumer_id,
      type: 'future_order_match',
      title: 'Future Order Matched',
      message: `${listing.producer_name ?? 'A producer'} near you listed ${listing.title}`,
      data: {
        futureOrderId: fo.id,
        listingId: listing.id,
        listingTitle: listing.title,
        producerName: listing.producer_name,
        distanceMiles: Math.round(distance * 10) / 10,
      },
    });

    matchCount++;
  }

  return matchCount;
}
