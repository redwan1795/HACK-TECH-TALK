import { pool } from '../db/pool';
import { haversineMiles } from '../utils/haversine';
import { lookupZip } from './geocodeService';

export interface SearchParams {
  q?: string;
  zip?: string;
  radiusMiles?: number;
  category?: string;
  page?: number;
  limit?: number;
  sort?: 'distance' | 'newest' | 'price_asc' | 'price_desc';
}

export interface ListingWithDistance {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priceCents: number | null;
  unit: string;
  quantityAvailable: number;
  exchangeFor: string | null;
  locationZip: string;
  locationLat: number | null;
  locationLng: number | null;
  images: string[];
  isAvailable: boolean;
  createdAt: string;
  distanceMiles: number | null;
  producer: {
    id: string;
    name: string | null;
    licensed: boolean;
  };
}

export async function searchListings(params: SearchParams): Promise<{
  listings: ListingWithDistance[];
  total: number;
  anchor: { zip: string; lat: number; lng: number } | null;
}> {
  const {
    q, zip, radiusMiles = 25,
    category, page = 1, limit = 20,
    sort = 'distance',
  } = params;

  // Build WHERE clauses
  const wheres: string[] = ['l.is_available = TRUE'];
  const values: any[] = [];

  if (q && q.trim()) {
    values.push(`%${q.trim().toLowerCase()}%`);
    wheres.push(`(LOWER(l.title) LIKE $${values.length} OR LOWER(l.description) LIKE $${values.length})`);
  }

  if (category) {
    values.push(category);
    wheres.push(`l.category = $${values.length}`);
  }

  // We always over-fetch (up to 200) then filter by radius in JS.
  // For hackathon scale this is more than fine and keeps the SQL simple.
  const sql = `
    SELECT
      l.id, l.title, l.description, l.category, l.price_cents, l.unit,
      l.quantity_available, l.exchange_for, l.location_zip,
      l.location_lat, l.location_lng, l.images, l.is_available, l.created_at,
      u.id AS producer_id, u.display_name AS producer_name, u.licensed AS producer_licensed
    FROM listings l
    JOIN users u ON u.id = l.producer_id
    WHERE ${wheres.join(' AND ')}
    ORDER BY l.created_at DESC
    LIMIT 200
  `;

  const { rows } = await pool.query(sql, values);

  // Resolve anchor if ZIP provided
  let anchor: { zip: string; lat: number; lng: number } | null = null;
  if (zip) {
    const geo = await lookupZip(zip);
    if (geo) anchor = { zip: geo.zip, lat: geo.lat, lng: geo.lng };
  }

  // Map with distance
  let listings: ListingWithDistance[] = rows.map((r: any) => {
    let distanceMiles: number | null = null;
    if (anchor && r.location_lat != null && r.location_lng != null) {
      distanceMiles = haversineMiles(
        anchor.lat, anchor.lng,
        Number(r.location_lat), Number(r.location_lng)
      );
    }
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      priceCents: r.price_cents,
      unit: r.unit,
      quantityAvailable: r.quantity_available,
      exchangeFor: r.exchange_for,
      locationZip: r.location_zip,
      locationLat: r.location_lat !== null ? Number(r.location_lat) : null,
      locationLng: r.location_lng !== null ? Number(r.location_lng) : null,
      images: r.images,
      isAvailable: r.is_available,
      createdAt: r.created_at,
      distanceMiles,
      producer: {
        id: r.producer_id,
        name: r.producer_name,
        licensed: r.producer_licensed,
      },
    };
  });

  // Radius filter (only if we have an anchor)
  if (anchor) {
    listings = listings.filter((l) => l.distanceMiles !== null && l.distanceMiles <= radiusMiles);
  }

  // Sort
  listings.sort((a, b) => {
    if (sort === 'distance' && anchor) {
      return (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity);
    }
    if (sort === 'price_asc')  return (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity);
    if (sort === 'price_desc') return (b.priceCents ?? -Infinity) - (a.priceCents ?? -Infinity);
    // newest
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const total = listings.length;
  const offset = (page - 1) * limit;
  return {
    listings: listings.slice(offset, offset + limit),
    total,
    anchor,
  };
}
