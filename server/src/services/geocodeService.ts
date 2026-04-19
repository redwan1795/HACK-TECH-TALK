import { zipToGeo, GeoResult } from '../integrations/maps/zippopotamAdapter';

// In-memory cache — replaces Redis. 24h TTL.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Fallback set for ZIPs we seed & demo with, so demos work even offline.
const FALLBACK: Record<string, GeoResult> = {
  '88001': { zip: '88001', lat: 32.3199, lng: -106.7637, placeName: 'Las Cruces', state: 'NM' },
  '88005': { zip: '88005', lat: 32.2800, lng: -106.7800, placeName: 'Las Cruces', state: 'NM' },
  '88011': { zip: '88011', lat: 32.3583, lng: -106.7122, placeName: 'Las Cruces', state: 'NM' },
  '87501': { zip: '87501', lat: 35.6870, lng: -105.9378, placeName: 'Santa Fe',   state: 'NM' },
  '87101': { zip: '87101', lat: 35.0844, lng: -106.6504, placeName: 'Albuquerque',state: 'NM' },
  '10001': { zip: '10001', lat: 40.7506, lng:  -73.9972, placeName: 'New York',   state: 'NY' },
  '94103': { zip: '94103', lat: 37.7726, lng: -122.4099, placeName: 'San Francisco', state: 'CA' },
};

interface CacheEntry {
  result: GeoResult;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function lookupZip(zip: string): Promise<GeoResult | null> {
  if (!/^\d{5}$/.test(zip)) return null;

  // Check in-memory cache
  const hit = cache.get(zip);
  if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
    return hit.result;
  }

  // Try network
  const remote = await zipToGeo(zip);
  if (remote) {
    cache.set(zip, { result: remote, cachedAt: Date.now() });
    return remote;
  }

  // Fallback table (important for reliable demos / offline)
  if (FALLBACK[zip]) {
    cache.set(zip, { result: FALLBACK[zip], cachedAt: Date.now() });
    return FALLBACK[zip];
  }

  return null;
}
