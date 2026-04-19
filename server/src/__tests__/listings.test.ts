/**
 * M2 — Listings CRUD + Search tests
 *
 * DB-dependent tests use a real test database and skip if unreachable.
 * Redis and axios (geocode) are mocked for isolation.
 */

// ── Mock Redis ────────────────────────────────────────────────────────────────
const mockRedisGet  = jest.fn().mockResolvedValue(null);
const mockRedisSet  = jest.fn().mockResolvedValue(undefined);
const mockGetDel    = jest.fn().mockResolvedValue(null);
const mockDel       = jest.fn().mockResolvedValue(undefined);
const mockQuit      = jest.fn().mockResolvedValue(undefined);

jest.mock('../db/redis', () => ({
  redisClient: {
    get:    mockRedisGet,
    set:    mockRedisSet,
    getDel: mockGetDel,
    del:    mockDel,
    quit:   mockQuit,
  },
}));

// ── Mock axios (geocode) ──────────────────────────────────────────────────────
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Default: return Las Cruces coords for any ZIP
const LAS_CRUCES = {
  data: {
    places: [
      {
        latitude: '32.3199',
        longitude: '-106.7637',
        'place name': 'Las Cruces',
        'state abbreviation': 'NM',
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
import request from 'supertest';
import { Pool } from 'pg';
import { createApp } from '../index';
import { closePool } from '../db/client';
import { signAccessToken } from '../services/tokenService';

const app = createApp();

const TEST_DB_URL =
  process.env.DATABASE_URL_TEST ??
  process.env.DATABASE_URL ??
  'postgresql://cg_user:cg_pass@localhost:5432/community_garden_test';

let pool: Pool;
let dbAvailable = false;

let producerToken: string;
let consumerToken: string;
let adminToken: string;

// Stable fake UUIDs for seeded users
const PRODUCER_ID = '00000000-0000-0000-0000-000000000001';
const CONSUMER_ID = '00000000-0000-0000-0000-000000000002';
const ADMIN_ID    = '00000000-0000-0000-0000-000000000003';

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 3000 });
  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    console.warn('Listings DB tests skipped — test database not reachable.');
  }

  // Always build tokens (no DB needed for token signing)
  producerToken = signAccessToken({ sub: PRODUCER_ID, role: 'producer', email: 'p@test.com' });
  consumerToken = signAccessToken({ sub: CONSUMER_ID, role: 'consumer', email: 'c@test.com' });
  adminToken    = signAccessToken({ sub: ADMIN_ID,    role: 'admin',    email: 'a@test.com' });
});

afterAll(async () => {
  await pool?.end().catch(() => {});
  await closePool();
});

beforeEach(async () => {
  if (!dbAvailable) return;
  // Remove test listings and the fake producer user (cascade)
  await pool.query("DELETE FROM listings WHERE producer_id IN ($1,$2,$3)", [
    PRODUCER_ID, CONSUMER_ID, ADMIN_ID,
  ]);
  await pool.query("DELETE FROM users WHERE id IN ($1,$2,$3)", [
    PRODUCER_ID, CONSUMER_ID, ADMIN_ID,
  ]);

  // Insert minimal user rows so FK on listings.producer_id works
  await pool.query(`
    INSERT INTO users (id, email, password_hash, name, role)
    VALUES
      ($1, 'prod@test.com',     'x', 'Producer', 'producer'),
      ($2, 'cons@test.com',     'x', 'Consumer', 'consumer'),
      ($3, 'admin@test.com',    'x', 'Admin',    'admin')
    ON CONFLICT (id) DO NOTHING
  `, [PRODUCER_ID, CONSUMER_ID, ADMIN_ID]);

  // Reset mocks
  mockRedisGet.mockReset();
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockReset();
  mockRedisSet.mockResolvedValue(undefined);
  mockedAxios.get.mockReset();
  mockedAxios.get.mockResolvedValue(LAS_CRUCES);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createListing(overrides: Record<string, string> = {}) {
  return request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${producerToken}`)
    .field('title', overrides.title ?? 'Test Zucchini')
    .field('category', overrides.category ?? 'vegetable')
    .field('quantity_available', overrides.quantity_available ?? '10')
    .field('location_zip', overrides.location_zip ?? '88001')
    .field('price_cents', overrides.price_cents ?? '300');
}

async function publishListing(id: string, publish = true, token = producerToken) {
  return request(app)
    .patch(`/api/v1/listings/${id}/publish`)
    .set('Authorization', `Bearer ${token}`)
    .send({ publish });
}

// ── POST /listings ────────────────────────────────────────────────────────────

describe('POST /listings', () => {
  it('producer creates listing → 201 with id, location_lat, location_lng set for ZIP 88001', async () => {
    if (!dbAvailable) return;

    const res = await createListing();
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.location_lat).toBeCloseTo(32.3199, 1);
    expect(res.body.location_lng).toBeCloseTo(-106.7637, 1);
    expect(res.body.category).toBe('vegetable');
  });

  it('returns 422 on missing title', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${producerToken}`)
      .field('category', 'vegetable')
      .field('quantity_available', '10')
      .field('location_zip', '88001');
    expect(res.status).toBe(422);
  });

  it('returns 422 on invalid ZIP (letters)', async () => {
    if (!dbAvailable) return;
    const res = await createListing({ location_zip: 'ABCDE' });
    expect(res.status).toBe(422);
  });

  it('returns 422 on invalid category', async () => {
    if (!dbAvailable) return;
    const res = await createListing({ category: 'pizza' });
    expect(res.status).toBe(422);
  });

  it('consumer token → 201 (any authenticated user can sell)', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${consumerToken}`)
      .field('title', 'Consumer Sells Too')
      .field('category', 'vegetable')
      .field('quantity_available', '5')
      .field('location_zip', '88001');
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.producer_id).toBe(CONSUMER_ID);
  });

  it('no token → 401', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .field('title', 'X')
      .field('category', 'vegetable')
      .field('quantity_available', '5')
      .field('location_zip', '88001');
    expect(res.status).toBe(401);
  });

  it('stores null location_lat/location_lng when geocode fails gracefully', async () => {
    if (!dbAvailable) return;
    mockedAxios.get.mockResolvedValue({ data: { places: [] } });

    const res = await createListing({ location_zip: '00000' });
    expect(res.status).toBe(201);
    expect(res.body.location_lat).toBeNull();
    expect(res.body.location_lng).toBeNull();
  });
});

// ── GET /listings ─────────────────────────────────────────────────────────────

describe('GET /listings', () => {
  let listingId: string;

  beforeEach(async () => {
    if (!dbAvailable) return;
    const res = await createListing();
    listingId = res.body.id;
    await publishListing(listingId);
  });

  it('returns only is_available=true listings', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/v1/listings');
    expect(res.status).toBe(200);
    expect(res.body.data.every((l: { is_available: boolean }) => l.is_available)).toBe(true);
  });

  it('filters by keyword case-insensitively', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/v1/listings?q=ZUCCHINI');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].title.toLowerCase()).toContain('zucchini');
  });

  it('returns distance_miles field when zip+radius_miles provided', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/v1/listings?zip=88001&radius_miles=50');
    expect(res.status).toBe(200);
    if (res.body.total > 0) {
      expect(res.body.data[0]).toHaveProperty('distance_miles');
    }
  });

  it('excludes listings outside radius (ZIP 10001 NY does not find Las Cruces listing)', async () => {
    if (!dbAvailable) return;
    // Override geocode: first call (for the listing creation) = Las Cruces,
    // second call (for the search ZIP 10001) = New York
    mockedAxios.get.mockResolvedValueOnce(LAS_CRUCES).mockResolvedValueOnce({
      data: {
        places: [{
          latitude: '40.7128', longitude: '-74.0060',
          'place name': 'New York', 'state abbreviation': 'NY',
        }],
      },
    });

    const res = await request(app).get('/api/v1/listings?q=zucchini&zip=10001&radius_miles=10');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('includes listings inside radius (ZIP 88001 finds Las Cruces listing within 10 miles)', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/v1/listings?q=zucchini&zip=88001&radius_miles=10');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('filters by category', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/v1/listings?category=vegetable');
    expect(res.status).toBe(200);
    expect(res.body.data.every((l: { category: string }) => l.category === 'vegetable')).toBe(true);
  });

  it('paginates: page=1&limit=1 returns 1 result', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/v1/listings?limit=1&page=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it('results sorted by distance_miles ascending when radius filter active', async () => {
    if (!dbAvailable) return;
    // Create a second listing with same ZIP
    const res2 = await createListing({ title: 'Tomatoes', category: 'vegetable', location_zip: '88001' });
    await publishListing(res2.body.id);

    const res = await request(app).get('/api/v1/listings?zip=88001&radius_miles=50');
    expect(res.status).toBe(200);
    const miles = res.body.data.map((l: { distance_miles: number }) => l.distance_miles);
    const sorted = [...miles].sort((a, b) => a - b);
    expect(miles).toEqual(sorted);
  });
});

// ── GET /listings/:id ─────────────────────────────────────────────────────────

describe('GET /listings/:id', () => {
  let listingId: string;

  beforeEach(async () => {
    if (!dbAvailable) return;
    const res = await createListing();
    listingId = res.body.id;
  });

  it('returns listing with producer_name joined from users table', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`/api/v1/listings/${listingId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('producer_name');
    expect(res.body.producer_name).toBe('Producer');
  });

  it('returns 404 for unknown id', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/v1/listings/00000000-0000-4000-8000-000000000099');
    expect(res.status).toBe(404);
  });

  it('returns 422 for non-UUID id', async () => {
    const res = await request(app).get('/api/v1/listings/not-a-uuid');
    expect(res.status).toBe(422);
  });
});

// ── PATCH /listings/:id/publish ───────────────────────────────────────────────

describe('PATCH /listings/:id/publish', () => {
  let listingId: string;

  beforeEach(async () => {
    if (!dbAvailable) return;
    const res = await createListing();
    listingId = res.body.id;
  });

  it('publishes a listing → is_available = true', async () => {
    if (!dbAvailable) return;
    const res = await publishListing(listingId, true);
    expect(res.status).toBe(200);
    expect(res.body.is_available).toBe(true);
  });

  it('unpublishes a listing → is_available = false', async () => {
    if (!dbAvailable) return;
    await publishListing(listingId, true);
    const res = await publishListing(listingId, false);
    expect(res.status).toBe(200);
    expect(res.body.is_available).toBe(false);
  });

  it('returns 422 when publishing a 0-quantity listing', async () => {
    if (!dbAvailable) return;
    const res0 = await createListing({ quantity_available: '0' });
    const res = await publishListing(res0.body.id, true);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CANNOT_PUBLISH');
  });

  it('returns 403 when a different producer tries to publish', async () => {
    if (!dbAvailable) return;
    const otherToken = signAccessToken({
      sub: '00000000-0000-0000-0000-000000000099',
      role: 'producer',
      email: 'other@test.com',
    });
    const res = await publishListing(listingId, true, otherToken);
    expect(res.status).toBe(403);
  });

  it('admin can publish any listing', async () => {
    if (!dbAvailable) return;
    const res = await publishListing(listingId, true, adminToken);
    expect(res.status).toBe(200);
    expect(res.body.is_available).toBe(true);
  });
});

// ── DELETE /listings/:id ──────────────────────────────────────────────────────

describe('DELETE /listings/:id', () => {
  let listingId: string;

  beforeEach(async () => {
    if (!dbAvailable) return;
    const createRes = await createListing();
    listingId = createRes.body.id;
    await publishListing(listingId);
  });

  it('soft-deletes: sets is_available = false, row still in DB', async () => {
    if (!dbAvailable) return;
    const delRes = await request(app)
      .delete(`/api/v1/listings/${listingId}`)
      .set('Authorization', `Bearer ${producerToken}`);
    expect(delRes.status).toBe(204);

    const { rows } = await pool.query('SELECT is_available FROM listings WHERE id = $1', [listingId]);
    expect(rows[0].is_available).toBe(false);
  });

  it('deleted listing no longer appears in GET /listings', async () => {
    if (!dbAvailable) return;
    await request(app)
      .delete(`/api/v1/listings/${listingId}`)
      .set('Authorization', `Bearer ${producerToken}`);

    const res = await request(app).get('/api/v1/listings');
    const ids = res.body.data.map((l: { id: string }) => l.id);
    expect(ids).not.toContain(listingId);
  });

  it('returns 403 for non-owner', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .delete(`/api/v1/listings/${listingId}`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(403);
  });
});

// ── M2-A: Delivery / Pickup fields ───────────────────────────────────────────

describe('POST /listings — delivery fields (M2-A)', () => {
  it('creates listing with ready_to_deliver=true, pickup fields are null', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${producerToken}`)
      .field('title', 'Delivers Listing')
      .field('category', 'vegetable')
      .field('quantity_available', '5')
      .field('location_zip', '88001')
      .field('ready_to_deliver', 'true');

    expect(res.status).toBe(201);
    expect(res.body.ready_to_deliver).toBe(true);
    expect(res.body.pickup_date).toBeNull();
    expect(res.body.pickup_time).toBeNull();
    expect(res.body.pickup_location).toBeNull();
  });

  it('creates listing with ready_to_deliver=false and full pickup info', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${producerToken}`)
      .field('title', 'Pickup Listing')
      .field('category', 'vegetable')
      .field('quantity_available', '5')
      .field('location_zip', '88001')
      .field('ready_to_deliver', 'false')
      .field('pickup_date', '2026-06-01')
      .field('pickup_time', '10:00')
      .field('pickup_location', '123 Main St, front porch');

    expect(res.status).toBe(201);
    expect(res.body.ready_to_deliver).toBe(false);
    expect(res.body.pickup_date).toBe('2026-06-01');
    expect(res.body.pickup_time).toMatch(/^10:00/);
    expect(res.body.pickup_location).toBe('123 Main St, front porch');
  });

  it('returns 422 when ready_to_deliver=false and pickup_location missing', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${producerToken}`)
      .field('title', 'No Location')
      .field('category', 'vegetable')
      .field('quantity_available', '5')
      .field('location_zip', '88001')
      .field('ready_to_deliver', 'false')
      .field('pickup_date', '2026-06-01')
      .field('pickup_time', '10:00');

    expect(res.status).toBe(422);
  });

  it('returns 422 when ready_to_deliver=false and pickup_date missing', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${producerToken}`)
      .field('title', 'No Date')
      .field('category', 'vegetable')
      .field('quantity_available', '5')
      .field('location_zip', '88001')
      .field('ready_to_deliver', 'false')
      .field('pickup_time', '10:00')
      .field('pickup_location', '123 Main St');

    expect(res.status).toBe(422);
  });

  it('returns 422 when ready_to_deliver=false and pickup_time missing', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${producerToken}`)
      .field('title', 'No Time')
      .field('category', 'vegetable')
      .field('quantity_available', '5')
      .field('location_zip', '88001')
      .field('ready_to_deliver', 'false')
      .field('pickup_date', '2026-06-01')
      .field('pickup_location', '123 Main St');

    expect(res.status).toBe(422);
  });
});

describe('GET /listings — delivery fields in results (M2-A)', () => {
  it('returns ready_to_deliver field on all results', async () => {
    if (!dbAvailable) return;
    const createRes = await createListing();
    await publishListing(createRes.body.id);

    const res = await request(app).get('/api/v1/listings');
    expect(res.status).toBe(200);
    const listing = res.body.data.find((l: { id: string }) => l.id === createRes.body.id);
    expect(listing).toBeDefined();
    expect(typeof listing.ready_to_deliver).toBe('boolean');
  });
});

describe('GET /listings/:id — delivery fields in single listing (M2-A)', () => {
  it('returns all delivery fields on a pickup listing', async () => {
    if (!dbAvailable) return;
    const createRes = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${producerToken}`)
      .field('title', 'Pickup Single')
      .field('category', 'fruit')
      .field('quantity_available', '3')
      .field('location_zip', '88001')
      .field('ready_to_deliver', 'false')
      .field('pickup_date', '2026-07-04')
      .field('pickup_time', '09:00')
      .field('pickup_location', '456 Farm Rd');

    const res = await request(app).get(`/api/v1/listings/${createRes.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ready_to_deliver).toBe(false);
    expect(res.body.pickup_date).toBe('2026-07-04');
    expect(res.body.pickup_time).toMatch(/^09:00/);
    expect(res.body.pickup_location).toBe('456 Farm Rd');
  });
});

// ── Any authenticated user can buy AND sell ───────────────────────────────────

describe('Cross-role: any authenticated user can create and manage listings', () => {
  it('consumer can create a listing and it appears in search', async () => {
    if (!dbAvailable) return;
    const createRes = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${consumerToken}`)
      .field('title', 'Backyard Eggs')
      .field('category', 'egg')
      .field('quantity_available', '12')
      .field('location_zip', '88001')
      .field('price_cents', '500');

    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    await request(app)
      .patch(`/api/v1/listings/${id}/publish`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ publish: true });

    const searchRes = await request(app).get('/api/v1/listings?q=Backyard');
    const ids = searchRes.body.data.map((l: { id: string }) => l.id);
    expect(ids).toContain(id);
  });

  it('consumer can publish their own listing', async () => {
    if (!dbAvailable) return;
    const createRes = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${consumerToken}`)
      .field('title', 'Tomatoes')
      .field('category', 'vegetable')
      .field('quantity_available', '8')
      .field('location_zip', '88001');

    const patchRes = await request(app)
      .patch(`/api/v1/listings/${createRes.body.id}/publish`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ publish: true });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.is_available).toBe(true);
  });

  it('consumer cannot delete a listing they do not own', async () => {
    if (!dbAvailable) return;
    const createRes = await createListing();
    const delRes = await request(app)
      .delete(`/api/v1/listings/${createRes.body.id}`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(delRes.status).toBe(403);
  });

  it('producer can browse listings created by a consumer', async () => {
    if (!dbAvailable) return;
    const createRes = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${consumerToken}`)
      .field('title', 'Fresh Basil')
      .field('category', 'other')
      .field('quantity_available', '5')
      .field('location_zip', '88001');

    await request(app)
      .patch(`/api/v1/listings/${createRes.body.id}/publish`)
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ publish: true });

    const browseRes = await request(app)
      .get('/api/v1/listings?q=Fresh+Basil')
      .set('Authorization', `Bearer ${producerToken}`);
    expect(browseRes.status).toBe(200);
    const found = browseRes.body.data.find((l: { id: string }) => l.id === createRes.body.id);
    expect(found).toBeDefined();
  });
});
