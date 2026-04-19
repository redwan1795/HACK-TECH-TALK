/**
 * M3 — AI Search tests
 *
 * Mocks @anthropic-ai/sdk, Redis, and axios (geocode).
 * DB is needed only for the integration route test; skipped if unreachable.
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

// ── Mock listingService (no DB needed) ────────────────────────────────────────
const mockSearchListings = jest.fn().mockResolvedValue({ data: [], total: 0 });
jest.mock('../services/listingService', () => ({
  searchListings: (...args: any[]) => mockSearchListings(...args),
}));

// ── Mock @anthropic-ai/sdk ─────────────────────────────────────────────────────
const mockMessagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockMessagesCreate },
    })),
  };
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

let consumerToken: string;
let producerToken: string;

// Fixture: Claude returns a valid tool_use block
const successResponse = {
  content: [
    {
      type: 'tool_use',
      id: 'tool_1',
      name: 'search_listings',
      input: { keyword: 'zucchini', zip: '88001', radius_miles: 25 },
    },
  ],
};

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 3000 });
  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    console.warn('AI search DB tests skipped — test database not reachable.');
  }

  consumerToken = signAccessToken({ sub: CONSUMER_ID, role: 'consumer', email: 'c@test.com' });
  producerToken = signAccessToken({ sub: PRODUCER_ID, role: 'producer', email: 'p@test.com' });
});

afterAll(async () => {
  await pool?.end().catch(() => {});
  await closePool();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockResolvedValue(undefined);
  mockedAxios.get.mockResolvedValue(LAS_CRUCES);
  mockMessagesCreate.mockResolvedValue(successResponse);
  mockSearchListings.mockResolvedValue({ data: [], total: 0 });
});

// ── Unit: aiSearchService ──────────────────────────────────────────────────────
describe('aiSearchService', () => {
  it('returns intent + results when Claude returns a tool call', async () => {
    const { aiSearch } = await import('../services/aiSearchService');
    const result = await aiSearch({ query: 'zucchini', userZip: '88001' });
    expect(result.intent).toContain('zucchini');
    expect(Array.isArray(result.results)).toBe(true);
    expect(typeof result.explanation).toBe('string');
  });

  it('falls back to keyword search when Claude throws', async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error('timeout'));
    const { aiSearch } = await import('../services/aiSearchService');
    const result = await aiSearch({ query: 'tomato', userZip: '88001' });
    expect(result.intent).toBe('fallback');
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('falls back when Claude returns no tool_use block', async () => {
    mockMessagesCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Sorry' }] });
    const { aiSearch } = await import('../services/aiSearchService');
    const result = await aiSearch({ query: 'tomato' });
    expect(result.intent).toBe('fallback');
  });
});

// ── Route: POST /api/v1/ai/search ─────────────────────────────────────────────
describe('POST /api/v1/ai/search', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/v1/ai/search').send({ query: 'zucchini' });
    expect(res.status).toBe(401);
  });

  it('returns 422 when query is too short', async () => {
    const res = await request(app)
      .post('/api/v1/ai/search')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ query: 'z' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when user_zip is invalid format', async () => {
    const res = await request(app)
      .post('/api/v1/ai/search')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ query: 'zucchini', user_zip: 'ABCDE' });
    expect(res.status).toBe(422);
  });

  it('returns 200 with intent, results, explanation for valid query', async () => {
    const res = await request(app)
      .post('/api/v1/ai/search')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ query: 'fresh zucchini' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('intent');
    expect(res.body).toHaveProperty('results');
    expect(res.body).toHaveProperty('explanation');
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('returns 200 with fallback when Claude fails', async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error('API error'));
    const res = await request(app)
      .post('/api/v1/ai/search')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ query: 'fresh tomato' });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('fallback');
  });

  it('returns 429 after 20 requests from the same user', async () => {
    // Simulate counter already at 20
    mockRedisGet.mockResolvedValue('20');
    const res = await request(app)
      .post('/api/v1/ai/search')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ query: 'zucchini fresh' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
