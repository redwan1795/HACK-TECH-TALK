/**
 * M4 — Future Orders tests
 *
 * Covers:
 *   Unit:        demandParseService (M4-U-01–05)
 *   Unit:        listingPublishFanout (M4-U-06–11)
 *   Unit:        notificationService (M4-U-12–14)
 *   Integration: future-orders routes + fanout (M4-I-01–12)
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
const LAS_CRUCES = {
  data: {
    places: [{
      latitude: '32.3199', longitude: '-106.7637',
      'place name': 'Las Cruces', 'state abbreviation': 'NM',
    }],
  },
};

// ── Mock @anthropic-ai/sdk ────────────────────────────────────────────────────
const mockMessagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

// ── Mock @sendgrid/mail ───────────────────────────────────────────────────────
const mockSgSend = jest.fn().mockResolvedValue([{ statusCode: 202 }]);
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send:      (...args: unknown[]) => mockSgSend(...args),
}));

// ── Mock stripe (needed by orders route loaded via createApp) ─────────────────
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
  }))
);

// ─────────────────────────────────────────────────────────────────────────────
import request from 'supertest';
import { Pool } from 'pg';
import { addDays, addHours } from 'date-fns';
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

const CONSUMER_ID  = 'a0000000-0000-0000-0000-000000000010';
const CONSUMER2_ID = 'a0000000-0000-0000-0000-000000000011';
const PRODUCER_ID  = 'a0000000-0000-0000-0000-000000000012';

let consumerToken:  string;
let consumer2Token: string;
let producerToken:  string;

// ── Default Claude success response ──────────────────────────────────────────
function makeClaudeResponse(overrides: Record<string, unknown> = {}) {
  return {
    content: [{
      type: 'tool_use',
      id: 'tool_1',
      name: 'create_future_order',
      input: {
        product_keyword:  'orange',
        quantity:         10,
        unit:             'unit',
        needed_by_date:   addDays(new Date(), 2).toISOString(),
        zip:              '88001',
        proximity_miles:  25,
        ...overrides,
      },
    }],
  };
}

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 3000 });
  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    console.warn('Future orders DB tests skipped — test database not reachable.');
  }

  consumerToken  = signAccessToken({ sub: CONSUMER_ID,  role: 'consumer', email: 'fo-c1@test.com' });
  consumer2Token = signAccessToken({ sub: CONSUMER2_ID, role: 'consumer', email: 'fo-c2@test.com' });
  producerToken  = signAccessToken({ sub: PRODUCER_ID,  role: 'producer', email: 'fo-p@test.com' });

  if (dbAvailable) {
    await pool.query(`
      INSERT INTO users (id, email, password_hash, name, role) VALUES
        ('${CONSUMER_ID}',  'fo-c1@test.com', 'x', 'FO Consumer1', 'consumer'),
        ('${CONSUMER2_ID}', 'fo-c2@test.com', 'x', 'FO Consumer2', 'consumer'),
        ('${PRODUCER_ID}',  'fo-p@test.com',  'x', 'FO Producer',  'producer')
      ON CONFLICT (id) DO NOTHING
    `);
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await pool.query(`DELETE FROM future_orders WHERE consumer_id IN ('${CONSUMER_ID}','${CONSUMER2_ID}')`);
    await pool.query(`DELETE FROM listings WHERE producer_id = '${PRODUCER_ID}'`);
    await pool.query(`DELETE FROM users WHERE id IN ('${CONSUMER_ID}','${CONSUMER2_ID}','${PRODUCER_ID}')`);
  }
  await pool?.end().catch(() => {});
  await closePool();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedAxios.get.mockResolvedValue(LAS_CRUCES);
  mockMessagesCreate.mockResolvedValue(makeClaudeResponse());
  mockSgSend.mockResolvedValue([{ statusCode: 202 }]);
});

// ═════════════════════════════════════════════════════════════════════════════
// M4-U-01–05  Unit: demandParseService
// ═════════════════════════════════════════════════════════════════════════════
describe('demandParseService — unit', () => {
  beforeEach(() => {
    jest.resetModules();
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse());
  });

  it('M4-U-01: extracts product_keyword from "I need 10 oranges"', async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse({ product_keyword: 'orange' }));
    const { parseDemandIntent } = await import('../services/demandParseService');
    const result = await parseDemandIntent('I need 10 oranges');
    expect(result.product_keyword).toBe('orange');
  });

  it('M4-U-02: extracts quantity from "10 oranges"', async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse({ quantity: 10 }));
    const { parseDemandIntent } = await import('../services/demandParseService');
    const result = await parseDemandIntent('I need 10 oranges');
    expect(result.quantity).toBe(10);
  });

  it('M4-U-03: converts relative date to ISO 8601', async () => {
    const twodays = addDays(new Date(), 2).toISOString();
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse({ needed_by_date: twodays }));
    const { parseDemandIntent } = await import('../services/demandParseService');
    const result = await parseDemandIntent('I need oranges in 2 days');
    expect(result.needed_by_date).toBeTruthy();
    expect(new Date(result.needed_by_date!).getTime()).toBeGreaterThan(Date.now());
  });

  it('M4-U-04: returns null needed_by_date when no date in query', async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse({ needed_by_date: undefined }));
    const { parseDemandIntent } = await import('../services/demandParseService');
    const result = await parseDemandIntent('I need some oranges');
    expect(result.needed_by_date).toBeNull();
  });

  it('M4-U-05: throws DemandParseError on Claude API failure', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API timeout'));
    const { parseDemandIntent, DemandParseError } = await import('../services/demandParseService');
    await expect(parseDemandIntent('need oranges')).rejects.toBeInstanceOf(DemandParseError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// M4-U-12–14  Unit: notificationService
// ═════════════════════════════════════════════════════════════════════════════
describe('notificationService — unit', () => {
  const params = {
    futureOrderId:  'fo-id',
    productKeyword: 'orange',
    quantityNeeded: 10,
    unit:           'unit',
    listingId:      'listing-id',
    listingTitle:   'Navel Oranges',
    listingZip:     '88001',
    consumerEmail:  'consumer@test.com',
    consumerName:   'Alice',
  };

  it('M4-U-12: calls sgMail.send with correct "to" address', async () => {
    const { sendFutureOrderMatch } = await import('../services/notificationService');
    await sendFutureOrderMatch(params);
    expect(mockSgSend).toHaveBeenCalledTimes(1);
    const call = mockSgSend.mock.calls[0][0];
    expect(call.to).toBe('consumer@test.com');
  });

  it('M4-U-13: email html includes listing title', async () => {
    const { sendFutureOrderMatch } = await import('../services/notificationService');
    await sendFutureOrderMatch(params);
    const call = mockSgSend.mock.calls[0][0];
    expect(call.html).toContain('Navel Oranges');
    expect(call.html).toContain('listing-id');
  });

  it('M4-U-14: does not throw when SendGrid errors (fire-and-forget)', async () => {
    mockSgSend.mockRejectedValueOnce(new Error('SendGrid down'));
    const { sendFutureOrderMatch } = await import('../services/notificationService');
    await expect(sendFutureOrderMatch(params)).resolves.toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// M4-I-01–03  POST /api/v1/ai/parse-demand
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/ai/parse-demand', () => {
  it('M4-I-01: returns parsed intent for valid consumer query', async () => {
    const res = await request(app)
      .post('/api/v1/ai/parse-demand')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ query: 'I need 10 oranges in 2 days near 88001' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('product_keyword');
    expect(res.body).toHaveProperty('quantity');
  });

  it('M4-I-02: returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/ai/parse-demand')
      .send({ query: 'I need oranges' });
    expect(res.status).toBe(401);
  });

  it('M4-I-03: returns 200 for producer role (any authenticated user can parse)', async () => {
    const res = await request(app)
      .post('/api/v1/ai/parse-demand')
      .set('Authorization', `Bearer ${producerToken}`)
      .send({ query: 'I need oranges' });
    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// M4-I-04–07  Future order CRUD routes (DB)
// ═════════════════════════════════════════════════════════════════════════════
describe('Future orders CRUD — DB integration', () => {
  const validBody = () => ({
    product_query:   'I need 10 oranges in 2 days',
    product_keyword: 'orange',
    quantity_needed: 10,
    unit:            'unit',
    zip:             '88001',
    expires_at:      addDays(new Date(), 3).toISOString(),
  });

  let createdId: string;

  it('M4-I-04: POST creates demand with status open', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/future-orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    expect(res.body.consumer_id).toBe(CONSUMER_ID);
    createdId = res.body.id;
  });

  it('M4-I-05: POST rejects expires_at in the past', async () => {
    const res = await request(app)
      .post('/api/v1/future-orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ ...validBody(), expires_at: addDays(new Date(), -1).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_EXPIRY');
  });

  it('M4-I-06: GET returns only own demands', async () => {
    if (!dbAvailable || !createdId) return;
    // Consumer2 creates their own demand
    await request(app)
      .post('/api/v1/future-orders')
      .set('Authorization', `Bearer ${consumer2Token}`)
      .send({ ...validBody(), zip: '10001' });

    const res = await request(app)
      .get('/api/v1/future-orders')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    const ids = (res.body.data as Array<{ consumer_id: string }>).map((r) => r.consumer_id);
    expect(ids.every((id) => id === CONSUMER_ID)).toBe(true);
  });

  it('M4-I-07: DELETE cancels demand', async () => {
    if (!dbAvailable || !createdId) return;
    const res = await request(app)
      .delete(`/api/v1/future-orders/${createdId}`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');

    const { rows } = await pool.query('SELECT status FROM future_orders WHERE id = $1', [createdId]);
    expect(rows[0].status).toBe('cancelled');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// M4-U-06–11 + M4-I-08–12  Listing publish fanout (DB)
// ═════════════════════════════════════════════════════════════════════════════
describe('Listing publish fanout — DB integration', () => {
  let listingId: string;
  let futureOrderId: string;

  async function seedListing(overrides: Record<string, unknown> = {}) {
    const { rows } = await pool.query(
      `INSERT INTO listings
         (producer_id, title, category, price_cents, quantity_available,
          location_zip, location_lat, location_lng, is_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
       RETURNING id`,
      [
        PRODUCER_ID,
        overrides.title ?? 'Navel Oranges',
        overrides.category ?? 'fruit',
        200,
        20,
        overrides.location_zip ?? '88001',
        overrides.location_lat ?? 32.3199,
        overrides.location_lng ?? -106.7637,
      ]
    );
    return rows[0].id as string;
  }

  async function seedFutureOrder(overrides: Record<string, unknown> = {}) {
    const { rows } = await pool.query(
      `INSERT INTO future_orders
         (consumer_id, product_query, product_keyword, quantity_needed, unit,
          zip, proximity_miles, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
       RETURNING id`,
      [
        CONSUMER_ID,
        overrides.product_query ?? 'I need oranges',
        overrides.product_keyword ?? 'orange',
        overrides.quantity_needed ?? 10,
        overrides.unit ?? 'unit',
        overrides.zip ?? '88001',
        overrides.proximity_miles ?? 25,
        overrides.expires_at ?? addDays(new Date(), 3).toISOString(),
      ]
    );
    return rows[0].id as string;
  }

  beforeEach(async () => {
    if (!dbAvailable) return;
    await pool.query(`DELETE FROM future_orders WHERE consumer_id = '${CONSUMER_ID}'`);
    await pool.query(`DELETE FROM listings WHERE producer_id = '${PRODUCER_ID}'`);
  });

  it('M4-U-06 / M4-I-08: publish triggers fanout and notifies matched consumer', async () => {
    if (!dbAvailable) return;
    listingId     = await seedListing();
    futureOrderId = await seedFutureOrder();

    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${producerToken}`)
      .send({ publish: true });

    expect(res.status).toBe(200);

    // Wait for setImmediate fanout
    await new Promise<void>((resolve) => setImmediate(resolve));
    // Give async DB writes a tick to settle
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    expect(mockSgSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'fo-c1@test.com' })
    );

    const { rows } = await pool.query('SELECT status, matched_listing_id FROM future_orders WHERE id = $1', [futureOrderId]);
    expect(rows[0].status).toBe('matched');
    expect(rows[0].matched_listing_id).toBe(listingId);
  }, 10000);

  it('M4-U-07 / M4-I-09: expired demand not notified', async () => {
    if (!dbAvailable) return;
    listingId = await seedListing();
    await seedFutureOrder({ expires_at: addDays(new Date(), -1).toISOString() });

    // Directly set past expires_at in DB (validation skipped at insert level for test)
    await pool.query(
      `UPDATE future_orders SET expires_at = $1 WHERE consumer_id = $2`,
      [addDays(new Date(), -1).toISOString(), CONSUMER_ID]
    );

    await request(app)
      .patch(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${producerToken}`)
      .send({ publish: true });

    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    expect(mockSgSend).not.toHaveBeenCalled();
  }, 10000);

  it('M4-U-08: already-matched demand is not notified again', async () => {
    if (!dbAvailable) return;
    listingId = await seedListing();
    const foId = await seedFutureOrder();
    // Pre-set status to matched
    await pool.query(`UPDATE future_orders SET status = 'matched' WHERE id = $1`, [foId]);

    await request(app)
      .patch(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${producerToken}`)
      .send({ publish: true });

    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    expect(mockSgSend).not.toHaveBeenCalled();
  }, 10000);

  it('M4-U-09 / M4-I-10: demand outside proximity radius not notified', async () => {
    if (!dbAvailable) return;
    // Listing in Las Cruces NM; demand zip far away (NYC ~2000 miles)
    listingId = await seedListing({ location_zip: '88001', location_lat: 32.3199, location_lng: -106.7637 });
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('10001')) {
        return Promise.resolve({ data: { places: [{ latitude: '40.7128', longitude: '-74.0060' }] } });
      }
      return Promise.resolve(LAS_CRUCES);
    });
    await seedFutureOrder({ zip: '10001', proximity_miles: 25 });

    await request(app)
      .patch(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${producerToken}`)
      .send({ publish: true });

    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    expect(mockSgSend).not.toHaveBeenCalled();
  }, 10000);

  it('M4-U-10: case-insensitive keyword match (Orange matches orange listing)', async () => {
    if (!dbAvailable) return;
    listingId = await seedListing({ title: 'Fresh Oranges' });
    await seedFutureOrder({ product_keyword: 'Orange' }); // uppercase

    await request(app)
      .patch(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${producerToken}`)
      .send({ publish: true });

    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    expect(mockSgSend).toHaveBeenCalled();
  }, 10000);

  it('M4-U-11: category match — "fruit" demand matches fruit listing', async () => {
    if (!dbAvailable) return;
    listingId = await seedListing({ category: 'fruit', title: 'Local Fruit Basket' });
    // Insert a demand with category 'fruit' and generic keyword that won't keyword-match title
    const { rows } = await pool.query(
      `INSERT INTO future_orders
         (consumer_id, product_query, product_keyword, category, quantity_needed, unit,
          zip, proximity_miles, expires_at, status)
       VALUES ($1,$2,$3,'fruit'::listing_category,$4,$5,$6,$7,$8,'open')
       RETURNING id`,
      [CONSUMER_ID, 'need some fruit', 'xyznosuch', 10, 'unit', '88001', 25, addDays(new Date(), 3).toISOString()]
    );
    futureOrderId = rows[0].id;

    await request(app)
      .patch(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${producerToken}`)
      .send({ publish: true });

    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    expect(mockSgSend).toHaveBeenCalled();
  }, 10000);

  it('M4-I-11: matched record updated with status=matched and matched_listing_id', async () => {
    if (!dbAvailable) return;
    listingId     = await seedListing();
    futureOrderId = await seedFutureOrder();

    await request(app)
      .patch(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${producerToken}`)
      .send({ publish: true });

    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    const { rows } = await pool.query(
      'SELECT status, matched_listing_id FROM future_orders WHERE id = $1',
      [futureOrderId]
    );
    expect(rows[0].status).toBe('matched');
    expect(rows[0].matched_listing_id).toBe(listingId);
  }, 10000);

  it('M4-I-12: fanout failure does not fail the publish endpoint', async () => {
    if (!dbAvailable) return;
    listingId = await seedListing();
    // Make sendGrid throw to simulate fanout failure
    mockSgSend.mockRejectedValue(new Error('sendgrid down'));
    await seedFutureOrder();

    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${producerToken}`)
      .send({ publish: true });

    // Publish must still succeed even if notification fails
    expect(res.status).toBe(200);
    expect(res.body.is_available).toBe(true);
  }, 10000);
});

// ═════════════════════════════════════════════════════════════════════════════
// Auth guard on future-orders routes
// ═════════════════════════════════════════════════════════════════════════════
describe('Future orders auth guards', () => {
  it('GET /future-orders — 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/future-orders');
    expect(res.status).toBe(401);
  });

  it('POST /future-orders — 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/v1/future-orders').send({});
    expect(res.status).toBe(401);
  });

  it('DELETE /future-orders/:id — 401 when unauthenticated', async () => {
    const res = await request(app).delete('/api/v1/future-orders/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
  });
});
