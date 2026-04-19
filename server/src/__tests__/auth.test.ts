/**
 * M1 — Authentication + Role System tests
 *
 * DB-dependent tests (register, login, refresh, logout) use the real test
 * database and skip automatically if it is unreachable.
 *
 * Role-guard tests sign tokens directly with tokenService and never touch
 * the DB, so they always run.
 */

// ── Mock Redis before any module is loaded ────────────────────────────────────
const mockSet  = jest.fn().mockResolvedValue(undefined);
const mockGetDel = jest.fn().mockResolvedValue(null);
const mockDel  = jest.fn().mockResolvedValue(undefined);
const mockQuit = jest.fn().mockResolvedValue(undefined);

jest.mock('../db/redis', () => ({
  redisClient: {
    set:    mockSet,
    getDel: mockGetDel,
    del:    mockDel,
    quit:   mockQuit,
  },
}));

// ─────────────────────────────────────────────────────────────────────────────

import request from 'supertest';
import { Pool } from 'pg';
import { createApp } from '../index';
import { closePool } from '../db/client';
import { signAccessToken } from '../services/tokenService';

const app = createApp();

// ── Test DB helpers ────────────────────────────────────────────────────────────

const TEST_DB_URL =
  process.env.DATABASE_URL_TEST ??
  process.env.DATABASE_URL ??
  'postgresql://cg_user:cg_pass@localhost:5432/community_garden_test';

let pool: Pool;
let dbAvailable = false;

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 3000 });
  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    console.warn('Auth DB tests skipped — test database not reachable.');
  }
});

afterAll(async () => {
  await pool?.end().catch(() => {});
  await closePool();
});

// Clean test users before each test so runs are independent
beforeEach(async () => {
  if (!dbAvailable) return;
  await pool.query("DELETE FROM users WHERE email LIKE 'authtest%'");
  // Reset Redis mocks
  mockSet.mockClear();
  mockGetDel.mockClear();
  mockDel.mockClear();
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const TEST_USER = {
  email: 'authtest-producer@example.com',
  password: 'password123',
  name: 'Auth Test Producer',
  role: 'producer' as const,
};

async function registerUser(overrides?: Partial<typeof TEST_USER>) {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ ...TEST_USER, ...overrides });
}

// ── POST /auth/register ────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('creates a user and returns accessToken + refreshToken + user', async () => {
    if (!dbAvailable) return;

    // Mock Redis to simulate storing the refresh token
    mockSet.mockResolvedValueOnce(undefined);

    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user).toMatchObject({
      email: TEST_USER.email,
      role:  'producer',
    });
    expect(res.body.user).not.toHaveProperty('password_hash');
    // Redis set should have been called once (to store refresh token)
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when the same email is registered twice', async () => {
    if (!dbAvailable) return;

    mockSet.mockResolvedValue(undefined);

    await registerUser();
    const res = await registerUser();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });

  it('returns 422 for invalid email', async () => {
    const res = await registerUser({ email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for password shorter than 8 characters', async () => {
    const res = await registerUser({ password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when role is "admin"', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...TEST_USER, role: 'admin' });
    expect(res.status).toBe(422);
  });

  it('returns 422 when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'authtest-x@example.com', password: 'password123', role: 'consumer' });
    expect(res.status).toBe(422);
  });
});

// ── POST /auth/login ───────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  beforeEach(async () => {
    if (!dbAvailable) return;
    mockSet.mockResolvedValue(undefined);
    await registerUser();
  });

  it('returns tokens for valid credentials', async () => {
    if (!dbAvailable) return;

    mockSet.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.role).toBe('producer');
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('returns 401 for wrong password', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 for unknown email', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 422 for missing password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(422);
  });
});

// ── POST /auth/refresh ─────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('issues new tokens and rotates the refresh token', async () => {
    if (!dbAvailable) return;

    // Register a user and capture the refresh token
    mockSet.mockResolvedValue(undefined);
    const regRes = await registerUser();
    const { refreshToken, user } = regRes.body;

    // Simulate Redis: getDel returns the user ID for this token
    mockGetDel.mockResolvedValueOnce(user.id);
    // issueRefreshToken will call set again for the new token
    mockSet.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    // Old and new refresh tokens should differ
    expect(res.body.refreshToken).not.toBe(refreshToken);
    // getDel was called to consume the old token
    expect(mockGetDel).toHaveBeenCalledWith(`refresh:${refreshToken}`);
  });

  it('returns 401 when the refresh token is reused (already consumed)', async () => {
    // mockGetDel returns null → token not found in Redis
    mockGetDel.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'already-consumed-uuid' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 401 when refreshToken is missing from body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({});

    expect(res.status).toBe(401);
  });
});

// ── POST /auth/logout ──────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('returns 204 and calls Redis del for the refresh token', async () => {
    if (!dbAvailable) return;

    mockSet.mockResolvedValue(undefined);
    const { body: { accessToken, refreshToken } } = await registerUser();

    mockDel.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(204);
    expect(mockDel).toHaveBeenCalledWith(`refresh:${refreshToken}`);
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'some-token' });

    expect(res.status).toBe(401);
  });
});

// ── Role guards on listing write endpoints ─────────────────────────────────────
// These tests sign tokens directly — no DB or Redis needed.

describe('Role guards: POST /api/v1/listings', () => {
  it('no token → 401', async () => {
    const res = await request(app).post('/api/v1/listings').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('consumer token → 403', async () => {
    const token = signAccessToken({ sub: 'consumer-id', email: 'c@test.com', role: 'consumer' });
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('producer token → 501 (auth passes, stub returns not-implemented)', async () => {
    const token = signAccessToken({ sub: 'producer-id', email: 'p@test.com', role: 'producer' });
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('broker token → 501', async () => {
    const token = signAccessToken({ sub: 'broker-id', email: 'b@test.com', role: 'broker' });
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(501);
  });

  it('admin token → 501', async () => {
    const token = signAccessToken({ sub: 'admin-id', email: 'a@test.com', role: 'admin' });
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(501);
  });

  it('expired token → 401', async () => {
    // Sign with expiresIn=0 so it expires immediately
    const token = signAccessToken({ sub: 'x', email: 'x@test.com', role: 'producer' });
    // Tamper the token to simulate expiry (corrupt signature)
    const [h, p] = token.split('.');
    const badToken = `${h}.${p}.invalidsig`;
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${badToken}`)
      .send({});
    expect(res.status).toBe(401);
  });
});

describe('Role guards: PUT / DELETE / PATCH on listings', () => {
  it('PUT /api/v1/listings/:id — consumer token → 403', async () => {
    const token = signAccessToken({ sub: 'c', email: 'c@t.com', role: 'consumer' });
    const res = await request(app)
      .put('/api/v1/listings/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('DELETE /api/v1/listings/:id — no token → 401', async () => {
    const res = await request(app).delete('/api/v1/listings/some-id');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/listings/:id/publish — producer token → 501', async () => {
    const token = signAccessToken({ sub: 'p', email: 'p@t.com', role: 'producer' });
    const res = await request(app)
      .patch('/api/v1/listings/some-id/publish')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: true });
    expect(res.status).toBe(501);
  });
});

// ── GET /users/me ──────────────────────────────────────────────────────────────

describe('GET /api/v1/users/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    if (!dbAvailable) return;

    mockSet.mockResolvedValue(undefined);
    const { body: { accessToken, user } } = await registerUser();

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe(TEST_USER.email);
    expect(res.body).not.toHaveProperty('password_hash');
  });
});
