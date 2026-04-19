/**
 * M5 — Admin config tests (GET + PATCH /admin/config)
 *
 * Role guards run without a DB.
 * DB-dependent tests (M5-I-05, M5-I-06) skip when test DB is unreachable.
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

const CONSUMER_ID = '00000000-0000-0000-0000-000000000102';
const PRODUCER_ID = '00000000-0000-0000-0000-000000000103';
const ADMIN_ID    = '00000000-0000-0000-0000-000000000104';

let consumerToken: string;
let producerToken: string;
let adminToken:    string;

let pool: Pool;
let dbAvailable = false;

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 3000 });
  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    console.warn('Admin config DB tests skipped — test database not reachable.');
  }

  consumerToken = signAccessToken({ sub: CONSUMER_ID, role: 'consumer', email: 'consumer@admintest.com' });
  producerToken = signAccessToken({ sub: PRODUCER_ID, role: 'producer', email: 'producer@admintest.com' });
  adminToken    = signAccessToken({ sub: ADMIN_ID,    role: 'admin',    email: 'admin@admintest.com' });

  if (dbAvailable) {
    await pool.query(`
      INSERT INTO users (id, email, password_hash, name, role) VALUES
        ('${CONSUMER_ID}', 'consumer@admintest.com', 'x', 'Consumer', 'consumer'),
        ('${PRODUCER_ID}', 'producer@admintest.com', 'x', 'Producer', 'producer'),
        ('${ADMIN_ID}',    'admin@admintest.com',    'x', 'Admin',    'admin')
      ON CONFLICT (id) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO platform_config (key, value) VALUES ('fee_percent', '7')
      ON CONFLICT (key) DO UPDATE SET value = '7'
    `);
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await pool.query(`DELETE FROM users WHERE id IN ('${CONSUMER_ID}','${PRODUCER_ID}','${ADMIN_ID}')`);
  }
  await pool?.end().catch(() => {});
  await closePool();
});

// ── Role guard tests (no DB needed) ───────────────────────────────────────────

describe('PATCH /admin/config — role guards', () => {
  it('M5-I-07: returns 401 with no token', async () => {
    const res = await request(app).patch('/api/v1/admin/config').send({ fee_percent: 5 });
    expect(res.status).toBe(401);
  });

  it('M5-I-07: returns 403 for consumer role', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/config')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ fee_percent: 5 });
    expect(res.status).toBe(403);
  });

  it('M5-I-07: returns 403 for producer role', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/config')
      .set('Authorization', `Bearer ${producerToken}`)
      .send({ fee_percent: 5 });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /admin/config — validation', () => {
  it('M5-I-08: returns 400 for fee_percent > 100', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fee_percent: 101 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('M5-I-09: returns 400 for fee_percent < 0', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fee_percent: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing fee_percent', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── DB-dependent tests ─────────────────────────────────────────────────────────

describe('GET /admin/config — M5-I-05', () => {
  it('returns current fee_percent', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .get('/api/v1/admin/config')
      .set('Authorization', `Bearer ${consumerToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.fee_percent).toBe('number');
  });
});

describe('PATCH /admin/config — M5-I-06', () => {
  it('admin updates fee; GET reflects new rate', async () => {
    if (!dbAvailable) return;

    const patchRes = await request(app)
      .patch('/api/v1/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fee_percent: 12 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.fee_percent).toBe(12);

    const getRes = await request(app)
      .get('/api/v1/admin/config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.fee_percent).toBe(12);

    // Restore to 7% after test
    await pool.query(`UPDATE platform_config SET value = '7' WHERE key = 'fee_percent'`);
  });
});
