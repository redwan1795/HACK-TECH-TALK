-- Demo seed data for Community Garden
-- Deterministic UUIDs and accounts matching both demo scenarios.
-- Usage: psql $DATABASE_URL < demo/seed-data.sql
--
-- Passwords: all accounts use 'password123'
-- Bcrypt hash of 'password123' at cost 10:
--   $2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi

-- ── Clean slate (cascade removes dependent rows) ───────────────────────────
TRUNCATE users, listings, orders, order_items, future_orders, subscriptions
  RESTART IDENTITY CASCADE;

-- ── Users ──────────────────────────────────────────────────────────────────
INSERT INTO users (id, email, password_hash, name, role, licensed) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'demo-consumer@test.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Alex Consumer',
    'consumer',
    false
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'demo-producer@test.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Sam Producer',
    'producer',
    true
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'demo-admin@test.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Admin User',
    'admin',
    false
  );

-- ── Listings (for Demo Scenario 1 — AI Search) ─────────────────────────────
INSERT INTO listings
  (id, producer_id, title, description, category,
   price_cents, quantity_available, unit, location_zip,
   location_lat, location_lng, is_available)
VALUES
  (
    'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Fresh Zucchini',
    'Locally grown, harvested this morning. Perfect for grilling or baking.',
    'vegetable',
    300, 20, 'lb', '88001', 32.3099, -106.7737, true
  ),
  (
    'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Heirloom Tomatoes',
    'Mixed variety — Cherokee Purple, Brandywine, and Green Zebra.',
    'vegetable',
    400, 15, 'lb', '88001', 32.3099, -106.7737, true
  ),
  (
    'aaaa0003-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Sweet Corn',
    '6-pack, picked daily at peak sweetness.',
    'vegetable',
    500, 30, 'bunch', '88005', 32.3500, -106.8000, true
  ),
  (
    'aaaa0004-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Farm Fresh Eggs',
    'Free-range, pasture-raised. Brown and white variety.',
    'egg',
    600, 12, 'dozen', '88001', 32.3099, -106.7737, true
  );

-- ── Platform config ─────────────────────────────────────────────────────────
INSERT INTO platform_config (key, value)
VALUES ('fee_percent', '7')
ON CONFLICT (key) DO UPDATE SET value = '7';
