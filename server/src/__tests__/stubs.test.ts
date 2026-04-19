/**
 * Stub endpoints return 501 Not Implemented
 *
 * Auth routes (/auth/*, /users/*) are implemented in M1 and are
 * excluded from this list. All remaining unimplemented route groups
 * must respond with HTTP 501 and NOT_IMPLEMENTED until their milestone.
 */

import request from 'supertest';
import { createApp } from '../index';
import * as dbClient from '../db/client';

// Prevent the db pool from being created / connecting during these tests
jest.mock('../db/client', () => ({
  getPool: jest.fn(),
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  withClient: jest.fn(),
  closePool: jest.fn(),
}));

// Prevent Redis from connecting during these tests
jest.mock('../db/redis', () => ({
  redisClient: {
    get:    jest.fn().mockResolvedValue(null),
    set:    jest.fn().mockResolvedValue(undefined),
    getDel: jest.fn().mockResolvedValue(null),
    del:    jest.fn().mockResolvedValue(undefined),
    quit:   jest.fn().mockResolvedValue(undefined),
  },
}));

const app = createApp();

// M3 implemented: /api/v1/orders, /api/v1/ai/search, /api/v1/admin/config
// M4 implemented: /api/v1/future-orders, /api/v1/ai/parse-demand
// M5 implemented: /api/v1/subscriptions, PATCH /api/v1/admin/config
const STUB_ROUTES: Array<{ method: 'get' | 'post' | 'put' | 'patch' | 'delete'; path: string }> = [
  // Still stubbed
  { method: 'post',   path: '/api/v1/exchanges' },
];

describe('M0-API-04: stub endpoints respond 501 NOT_IMPLEMENTED', () => {
  it.each(STUB_ROUTES)(
    '$method $path → 501',
    async ({ method, path }) => {
      const res = await (request(app) as unknown as Record<string, (path: string) => request.Test>)[method](path)
        .set('Content-Type', 'application/json')
        .send({});

      expect(res.status).toBe(501);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code', 'NOT_IMPLEMENTED');
    }
  );
});

describe('Health endpoint', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});

describe('listings write stubs: no token → 401, wrong role → 403', () => {
  it('POST /api/v1/listings with no token → 401', async () => {
    const res = await request(app).post('/api/v1/listings').send({});
    expect(res.status).toBe(401);
  });

  it('PUT /api/v1/listings/:id with no token → 401', async () => {
    const res = await request(app).put('/api/v1/listings/some-id').send({});
    expect(res.status).toBe(401);
  });

  it('DELETE /api/v1/listings/:id with no token → 401', async () => {
    const res = await request(app).delete('/api/v1/listings/some-id');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/listings/:id/publish with no token → 401', async () => {
    const res = await request(app).patch('/api/v1/listings/some-id/publish').send({});
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/listings/:id → 422 for non-UUID id (M2 handler, no auth needed)', async () => {
    const res = await request(app).get('/api/v1/listings/some-id');
    expect(res.status).toBe(422);
  });
});

// Suppress the unused mock warning
afterAll(() => {
  jest.restoreAllMocks();
  (dbClient.closePool as jest.Mock).mockResolvedValue(undefined);
});
