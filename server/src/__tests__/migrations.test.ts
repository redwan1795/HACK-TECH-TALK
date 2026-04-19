/**
 * M0-DB-01 — All 7 migration files run without error on a clean DB
 * M0-DB-02 — All expected indexes exist after migration
 * M0-DB-03 — Migrations are idempotent (running twice does not error)
 * M0-DB-04 — platform_config has fee_percent row
 * M0-DB-05 — Foreign key constraints are enforced
 */

import { Pool } from 'pg';
import { runMigrations } from '../db/migrate';

const TEST_DB_URL =
  process.env.DATABASE_URL_TEST ??
  process.env.DATABASE_URL ??
  'postgresql://cg_user:cg_pass@localhost:5432/community_garden_test';

const DB_AVAILABLE = TEST_DB_URL !== '';

let pool: Pool;

function skipIfNoDb() {
  if (!DB_AVAILABLE) {
    console.warn('Skipping DB tests — set DATABASE_URL_TEST to run them (requires Docker).');
  }
  return !DB_AVAILABLE;
}

beforeAll(async () => {
  if (skipIfNoDb()) return;
  pool = new Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 3000 });

  // Verify connection — skip suite if DB is unreachable
  try {
    await pool.query('SELECT 1');
  } catch {
    await pool.end().catch(() => {});
    (pool as unknown as { _skip: boolean })._skip = true;
  }
});

afterAll(async () => {
  if (pool) await pool.end().catch(() => {});
});

function isConnected(): boolean {
  return pool && !(pool as unknown as { _skip?: boolean })._skip;
}

// ─── M0-DB-01: All 7 migrations apply cleanly ─────────────────────────────────
describe('M0-DB-01: migrations apply to a clean database', () => {
  it('runs all migration files without throwing', async () => {
    if (!isConnected()) return;

    // Drop and recreate schema to ensure clean state
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await expect(runMigrations(pool)).resolves.not.toThrow();
  });

  it('creates all 7 expected tables', async () => {
    if (!isConnected()) return;

    const { rows } = await pool.query(`
      SELECT table_name
      FROM   information_schema.tables
      WHERE  table_schema = 'public'
        AND  table_type   = 'BASE TABLE'
      ORDER  BY table_name
    `);
    const names = rows.map((r: { table_name: string }) => r.table_name);

    expect(names).toContain('users');
    expect(names).toContain('listings');
    expect(names).toContain('orders');
    expect(names).toContain('order_items');
    expect(names).toContain('subscriptions');
    expect(names).toContain('exchanges');
    expect(names).toContain('future_orders');
    expect(names).toContain('platform_config');
    expect(names).toContain('_migrations');
  });
});

// ─── M0-DB-02: Indexes exist ──────────────────────────────────────────────────
describe('M0-DB-02: expected indexes exist after migration', () => {
  const expectedIndexes = [
    'idx_users_email',
    'idx_users_role',
    'idx_listings_producer_id',
    'idx_listings_location_zip',
    'idx_listings_category',
    'idx_listings_is_available',
    'idx_orders_consumer_id',
    'idx_orders_status',
    'idx_order_items_order',
    'idx_subscriptions_consumer',
    'idx_exchanges_listing',
    'idx_future_orders_status',
    'idx_future_orders_consumer',
    'idx_future_orders_expires_at',
    'idx_future_orders_keyword',
  ];

  it.each(expectedIndexes)('index %s exists', async (indexName) => {
    if (!isConnected()) return;

    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = $1`,
      [indexName]
    );
    expect(rows).toHaveLength(1);
  });
});

// ─── M0-DB-03: Idempotent ─────────────────────────────────────────────────────
describe('M0-DB-03: migrations are idempotent', () => {
  it('running migrations a second time does not throw', async () => {
    if (!isConnected()) return;
    await expect(runMigrations(pool)).resolves.not.toThrow();
  });
});

// ─── M0-DB-04: Seed data in platform_config ───────────────────────────────────
describe('M0-DB-04: platform_config has fee_percent', () => {
  it('fee_percent row exists with a numeric string value', async () => {
    if (!isConnected()) return;

    const { rows } = await pool.query(
      `SELECT value FROM platform_config WHERE key = 'fee_percent'`
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].value)).toBeGreaterThan(0);
  });

  it('ai_search_enabled row exists', async () => {
    if (!isConnected()) return;

    const { rows } = await pool.query(
      `SELECT value FROM platform_config WHERE key = 'ai_search_enabled'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('true');
  });
});

// ─── M0-DB-05: FK constraints ─────────────────────────────────────────────────
describe('M0-DB-05: foreign key constraints are enforced', () => {
  it('inserting a listing with non-existent producer_id throws PG error 23503', async () => {
    if (!isConnected()) return;

    await expect(
      pool.query(`
        INSERT INTO listings
          (producer_id, title, category, quantity_available, location_zip)
        VALUES
          ('00000000-dead-beef-0000-000000000000', 'Test', 'vegetable', 1, '00000')
      `)
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('inserting an order with non-existent consumer_id throws PG error 23503', async () => {
    if (!isConnected()) return;

    await expect(
      pool.query(`
        INSERT INTO orders
          (consumer_id, status, subtotal_cents, fee_percent, platform_fee_cents, total_cents)
        VALUES
          ('00000000-dead-beef-0000-000000000001', 'pending', 100, 7, 7, 107)
      `)
    ).rejects.toMatchObject({ code: '23503' });
  });
});
