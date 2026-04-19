/**
 * M5 — Subscriptions route tests (POST, GET, DELETE /subscriptions)
 *
 * Stripe is mocked. DB-dependent tests skip when test DB is unreachable.
 */

// ── Mock Redis ─────────────────────────────────────────────────────────────────
jest.mock('../db/redis', () => ({
  redisClient: {
    get:    jest.fn().mockResolvedValue(null),
    set:    jest.fn().mockResolvedValue(undefined),
    getDel: jest.fn().mockResolvedValue(null),
    del:    jest.fn().mockResolvedValue(undefined),
    quit:   jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Mock Stripe ───────────────────────────────────────────────────────────────
const mockSubsCreate = jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'active' });
const mockSubsCancel = jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'canceled' });

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    subscriptions: {
      create: mockSubsCreate,
      cancel: mockSubsCancel,
    },
  }));
});

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

const CONSUMER_ID  = '00000000-0000-0000-0000-000000000201';
const CONSUMER2_ID = '00000000-0000-0000-0000-000000000202';
const PRODUCER_ID  = '00000000-0000-0000-0000-000000000203';

let consumerToken:  string;
let consumer2Token: string;
let producerToken:  string;

let pool: Pool;
let dbAvailable = false;
let testListingId: string;
let testSubId: string;

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 3000 });
  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    console.warn('Subscriptions DB tests skipped — test database not reachable.');
  }

  consumerToken  = signAccessToken({ sub: CONSUMER_ID,  role: 'consumer', email: 'c1@subtest.com' });
  consumer2Token = signAccessToken({ sub: CONSUMER2_ID, role: 'consumer', email: 'c2@subtest.com' });
  producerToken  = signAccessToken({ sub: PRODUCER_ID,  role: 'producer', email: 'p@subtest.com' });

  if (dbAvailable) {
    await pool.query(`
      INSERT INTO users (id, email, password_hash, name, role) VALUES
        ('${CONSUMER_ID}',  'c1@subtest.com', 'x', 'Consumer1', 'consumer'),
        ('${CONSUMER2_ID}', 'c2@subtest.com', 'x', 'Consumer2', 'consumer'),
        ('${PRODUCER_ID}',  'p@subtest.com',  'x', 'Producer',  'producer')
      ON CONFLICT (id) DO NOTHING
    `);

    const { rows } = await pool.query(`
      INSERT INTO listings
        (producer_id, title, category, price_cents, quantity_available, location_zip, is_available)
      VALUES ('${PRODUCER_ID}', 'Navel Oranges', 'fruit', 200, 50, '88001', true)
      RETURNING id
    `);
    testListingId = rows[0].id;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await pool.query(`DELETE FROM subscriptions WHERE consumer_id IN ('${CONSUMER_ID}','${CONSUMER2_ID}')`);
    await pool.query(`DELETE FROM listings WHERE producer_id = '${PRODUCER_ID}'`);
    await pool.query(`DELETE FROM users WHERE id IN ('${CONSUMER_ID}','${CONSUMER2_ID}','${PRODUCER_ID}')`);
  }
  await pool?.end().catch(() => {});
  await closePool();
});

// ── Role guard tests (no DB needed) ───────────────────────────────────────────

describe('POST /subscriptions — role guards', () => {
  it('M5-I-02: returns 403 for producer role', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${producerToken}`)
      .send({ listing_id: '00000000-0000-0000-0000-000000000000', cadence: 'weekly', quantity: 1 });
    expect(res.status).toBe(403);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions')
      .send({ listing_id: '00000000-0000-0000-0000-000000000000', cadence: 'weekly', quantity: 1 });
    expect(res.status).toBe(401);
  });
});

describe('POST /subscriptions — validation', () => {
  it('M5-I-03: returns 400 for invalid cadence', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ listing_id: '00000000-0000-0000-0000-000000000000', cadence: 'daily', quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid listing_id UUID', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ listing_id: 'not-a-uuid', cadence: 'weekly', quantity: 1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for quantity 0', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ listing_id: '00000000-0000-0000-0000-000000000000', cadence: 'weekly', quantity: 0 });
    expect(res.status).toBe(400);
  });
});

// ── DB-dependent tests ─────────────────────────────────────────────────────────

describe('POST /subscriptions — M5-I-01', () => {
  it('creates subscription with status active', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ listing_id: testListingId, cadence: 'weekly', quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.cadence).toBe('weekly');
    expect(res.body.consumer_id).toBe(CONSUMER_ID);
    expect(res.body.listing_id).toBe(testListingId);

    testSubId = res.body.id;

    const { rows } = await pool.query(`SELECT * FROM subscriptions WHERE id = $1`, [testSubId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('active');
  });
});

describe('GET /subscriptions — M5-I-04', () => {
  it('returns only the authenticated consumer own subscriptions', async () => {
    if (!dbAvailable) return;

    // Consumer 2 creates their own subscription
    await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${consumer2Token}`)
      .send({ listing_id: testListingId, cadence: 'monthly', quantity: 1 });

    const res = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${consumerToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: any) => s.consumer_id);
    expect(ids.every((id: string) => id === CONSUMER_ID)).toBe(true);
    // Consumer 2's subscription must not appear
    const consumer2Subs = res.body.data.filter((s: any) => s.consumer_id === CONSUMER2_ID);
    expect(consumer2Subs).toHaveLength(0);
  });

  it('returns 403 for producer role', async () => {
    const res = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${producerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /subscriptions/:id', () => {
  it('cancels subscription and updates status', async () => {
    if (!dbAvailable || !testSubId) return;

    const res = await request(app)
      .delete(`/api/v1/subscriptions/${testSubId}`)
      .set('Authorization', `Bearer ${consumerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');

    const { rows } = await pool.query(`SELECT status FROM subscriptions WHERE id = $1`, [testSubId]);
    expect(rows[0].status).toBe('cancelled');
  });

  it('returns 403 when different consumer tries to cancel', async () => {
    if (!dbAvailable) return;

    // Create a sub for consumer 1
    const create = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ listing_id: testListingId, cadence: 'biweekly', quantity: 1 });
    const subId = create.body.id;

    const res = await request(app)
      .delete(`/api/v1/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${consumer2Token}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent subscription', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .delete('/api/v1/subscriptions/ffffffff-ffff-4fff-bfff-ffffffffffff')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(404);
  });
});
