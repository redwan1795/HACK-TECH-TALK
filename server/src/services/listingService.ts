import { query } from '../db/client';
import { getCoordinatesForZip } from './geocodeService';

export interface ListingSearchParams {
  q?: string;
  zip?: string;
  radius_miles?: number;
  category?: string;
  page?: number;
  limit?: number;
}

export interface ListingRow {
  id: string;
  producer_id: string;
  title: string;
  description: string | null;
  category: string;
  price_cents: number | null;
  quantity_available: number;
  location_zip: string;
  location_lat: number | null;
  location_lng: number | null;
  images: string[];
  is_available: boolean;
  ready_to_deliver: boolean;
  pickup_date: string | null;
  pickup_time: string | null;
  pickup_location: string | null;
  created_at: string;
  distance_miles?: number;
}

function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchListings(params: ListingSearchParams): Promise<{
  data: ListingRow[];
  total: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['l.is_available = TRUE'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.q) {
    conditions.push(
      `(l.title ILIKE $${paramIndex} OR l.description ILIKE $${paramIndex})`
    );
    values.push(`%${params.q}%`);
    paramIndex++;
  }

  if (params.category) {
    conditions.push(`l.category = $${paramIndex}::listing_category`);
    values.push(params.category);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT l.id, l.producer_id, l.title, l.description, l.category,
            l.price_cents, l.quantity_available,
            l.location_zip, l.location_lat, l.location_lng,
            l.images, l.is_available,
            l.ready_to_deliver, l.pickup_date, l.pickup_time, l.pickup_location,
            l.created_at
     FROM listings l
     WHERE ${whereClause}
     ORDER BY l.created_at DESC`,
    values
  );
  const rows = result.rows as ListingRow[];

  let filtered = rows;
  if (params.zip && params.radius_miles) {
    const origin = await getCoordinatesForZip(params.zip);
    if (origin) {
      filtered = rows
        .filter((row) => {
          if (row.location_lat == null || row.location_lng == null) return false;
          const dist = haversineDistanceMiles(
            origin.lat, origin.lng,
            row.location_lat, row.location_lng,
          );
          return dist <= params.radius_miles!;
        })
        .map((row) => ({
          ...row,
          distance_miles: Math.round(
            haversineDistanceMiles(
              origin.lat, origin.lng,
              row.location_lat!, row.location_lng!,
            ) * 10
          ) / 10,
        }))
        .sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));
    }
  }

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  return { data: paginated, total };
}
