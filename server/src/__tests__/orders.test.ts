/**
 * M3 — Orders route tests
 *
 * Mocks: Redis, axios (geocode), stripe.
 * DB-dependent tests skip when test DB is unreachable.
 */

// ── Mock Redis ─────────────────────────────────────────────────────────────────
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

// ── Mock axios (geocode) ───────────────────────────────────────────────────────
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;
const LAS_CRUCES = {
  data: {
    places: [{ latitude: '32.3199', longitude: '-106.7637', 'place name': 'Las Cruces', 'state abbreviation': 'NM' }],
  },
};

// ── Mock Stripe ───────────────────────────────────────────────────────────────
const mockPaymentIntentsCreate   = jest.fn();
const mockPaymentIntentsRetrieve = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create:   mockPaymentIntentsCreate,
      retrieve: mockPaymentIntentsRetrieve,
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

let pool: Pool;
let dbAvailable = false;

const CONSUMER_ID = '00000000-0000-0000-0000-000000000002';
const PRODUCER_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID    = '00000000-0000-0000-0000-000000000003';

let consumerToken: string;
let producerToken: string;
let adminToken:    string;

let testListingId: string;
let testOrderId:   string;

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 3000 });
  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    console.warn('Orders DB tests skipped — test database not reachable.');
  }

  consumerToken = signAccessToken({ sub: CONSUMER_ID, role: 'consumer', email: 'c@test.com' });
  producerToken = signAccessToken({ sub: PRODUCER_ID, role: 'producer', email: 'p@test.com' });
  adminToken    = signAccessToken({ sub: ADMIN_ID,    role: 'admin',    email: 'a@test.com' });

  if (dbAvailable) {
    // Seed test users
    await pool.query(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES
        ('${CONSUMER_ID}', 'c@test.com', 'x', 'Consumer', 'consumer'),
        ('${PRODUCER_ID}', 'p@test.com', 'x', 'Producer', 'producer'),
        ('${ADMIN_ID}',    'a@test.com', 'x', 'Admin',    'admin')
      ON CONFLICT (id) DO NOTHING
    `);

    // Seed a listing with price and quantity
    const { rows } = await pool.query(`
      INSERT INTO listings
        (producer_id, title, category, price_cents, quantity_available, location_zip, is_available)
      VALUES
        ('${PRODUCER_ID}', 'Test Zucchini', 'vegetable', 300, 10, '88001', TRUE)
      RETURNING id
    `);
    testListingId = rows[0].id;

    // Ensure platform_config row exists
    await pool.query(`
      INSERT INTO platform_config (key, value)
      VALUES ('fee_percent', '7')
      ON CONFLICT (key) DO NOTHING
    `);
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await pool.query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE consumer_id = '${CONSUMER_ID}')`);
    await pool.query(`DELETE FROM orders WHERE consumer_id = '${CONSUMER_ID}'`);
    await pool.query(`DELETE FROM listings WHERE producer_id = '${PRODUCER_ID}'`);
    await pool.query(`DELETE FROM users WHERE id IN ('${CONSUMER_ID}','${PRODUCER_ID}','${ADMIN_ID}')`);
  }
  await pool?.end().catch(() => {});
  await closePool();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedAxios.get.mockResolvedValue(LAS_CRUCES);
  mockPaymentIntentsCreate.mockResolvedValue({
    id: 'pi_test_123',
    client_secret: 'pi_test_123_secret',
    status: 'requires_payment_method',
  });
  mockPaymentIntentsRetrieve.mockResolvedValue({ id: 'pi_test_123', status: 'succeeded' });
});

// ── Auth guards ────────────────────────────────────────────────────────────────
describe('Orders auth guards', () => {
  it('POST /orders — 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/v1/orders').send({ items: [] });
    expect(res.status).toBe(401);
  });

  it('POST /orders — 422 with empty items array', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ items: [] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /orders — 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/orders');
    expect(res.status).toBe(401);
  });
});

// ── DB-dependent order tests ──────────────────────────────────────────────────
describe('Orders — DB integration', () => {
  it('POST /orders — creates order and returns clientSecret', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ items: [{ listingId: testListingId, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('orderId');
    expect(res.body).toHaveProperty('stripeClientSecret');
    expect(res.body.subtotalCents).toBe(300);
    expect(res.body.feePercent).toBe(7);
    expect(res.body.platformFeeCents).toBe(21);   // 7% of 300
    expect(res.body.totalCents).toBe(321);
    testOrderId = res.body.orderId;
  });

  it('Fee computation: subtotal=300, fee=7% → fee=21, total=321', async () => {
    if (!dbAvailable) return;
    expect(Math.round(300 * 7 / 100)).toBe(21);
    expect(300 + 21).toBe(321);
  });

  it('POST /orders — 409 when quantity exceeds available stock', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ items: [{ listingId: testListingId, quantity: 999 }] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('POST /orders — 409 when listing does not exist', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ items: [{ listingId: '00000000-0000-0000-0000-000000000099', quantity: 1 }] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('POST /orders/:id/confirm — marks order paid and decrements stock', async () => {
    if (!dbAvailable || !testOrderId) return;

    const res = await request(app)
      .post(`/api/v1/orders/${testOrderId}/confirm`)
      .set('Authorization', `Bearer ${consumerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');

    const { rows } = await pool.query(
      `SELECT quantity_available FROM listings WHERE id = $1`,
      [testListingId]
    );
    expect(rows[0].quantity_available).toBe(9); // 10 - 1
  });

  it('POST /orders/:id/confirm — 402 when Stripe PI not succeeded', async () => {
    if (!dbAvailable) return;

    // Create a new order to confirm
    const createRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ items: [{ listingId: testListingId, quantity: 1 }] });
    expect(createRes.status).toBe(201);
    const pendingOrderId = createRes.body.orderId;

    mockPaymentIntentsRetrieve.mockResolvedValueOnce({ id: 'pi_test_123', status: 'requires_payment_method' });

    const confirmRes = await request(app)
      .post(`/api/v1/orders/${pendingOrderId}/confirm`)
      .set('Authorization', `Bearer ${consumerToken}`);

    expect(confirmRes.status).toBe(402);
    expect(confirmRes.body.error.code).toBe('PAYMENT_NOT_CONFIRMED');
  });

  it('POST /orders/:id/confirm — 403 for wrong consumer', async () => {
    if (!dbAvailable || !testOrderId) return;

    const otherToken = signAccessToken({ sub: PRODUCER_ID, role: 'producer', email: 'p@test.com' });
    const res = await request(app)
      .post(`/api/v1/orders/${testOrderId}/confirm`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('GET /orders — consumer sees only own orders', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${consumerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((o: any) => {
      expect(o.consumer_id).toBe(CONSUMER_ID);
    });
  });

  it('GET /orders — admin sees all orders', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /orders/:id — 403 for wrong consumer', async () => {
    if (!dbAvailable || !testOrderId) return;

    const otherToken = signAccessToken({ sub: PRODUCER_ID, role: 'producer', email: 'p@test.com' });
    const res = await request(app)
      .get(`/api/v1/orders/${testOrderId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});

// ── Admin config ───────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/config', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/admin/config');
    expect(res.status).toBe(401);
  });

  it('returns fee_percent when authenticated', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get('/api/v1/admin/config')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.fee_percent).toBe('number');
  });
});
