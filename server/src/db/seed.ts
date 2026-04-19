import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

export async function runSeed(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash('demo1234', 10);
    await client.query('BEGIN');

    // ── Users ─────────────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO users
        (id, email, password_hash, name, role, location_zip, location_lat, location_lng)
      VALUES
        -- Producers
        ('a0000001-0000-4000-8000-000000000001',
         'maria.green@demo.com', $1, 'Maria Green', 'producer',
         '88001', 32.3265, -106.7893),
        ('a0000001-0000-4000-8000-000000000002',
         'james.farm@demo.com',  $1, 'James Carter', 'producer',
         '88005', 32.3161, -106.7991),
        ('a0000001-0000-4000-8000-000000000003',
         'linda.garden@demo.com',$1, 'Linda Torres', 'producer',
         '88007', 32.2999, -106.7450),

        -- Consumers
        ('a0000001-0000-4000-8000-000000000004',
         'alex.buyer@demo.com',  $1, 'Alex Rivera', 'consumer',
         '88001', 32.3215, -106.7833),
        ('a0000001-0000-4000-8000-000000000005',
         'sarah.shop@demo.com',  $1, 'Sarah Kim', 'consumer',
         '88011', 32.3789, -106.7389),
        ('a0000001-0000-4000-8000-000000000006',
         'mike.local@demo.com',  $1, 'Mike Patel', 'consumer',
         '88005', 32.3100, -106.7900)
      ON CONFLICT (id) DO NOTHING
    `, [hash]);

    // ── Listings ──────────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO listings
        (id, producer_id, title, description, category,
         price_cents, quantity_available, exchange_for,
         location_zip, location_lat, location_lng,
         images, is_available,
         ready_to_deliver, pickup_date, pickup_time, pickup_location)
      VALUES

        -- Maria Green (delivers)
        ('b0000002-0000-4000-8000-000000000001',
         'a0000001-0000-4000-8000-000000000001',
         'Organic Zucchini', 'Harvested this morning, no pesticides. Tender and sweet.',
         'vegetable', 250, 18, NULL,
         '88001', 32.3265, -106.7893, '{}', TRUE,
         TRUE, NULL, NULL, NULL),

        ('b0000002-0000-4000-8000-000000000002',
         'a0000001-0000-4000-8000-000000000001',
         'Cherokee Purple Tomatoes', 'Heirloom variety, rich and smoky flavor. Great for salads.',
         'vegetable', 400, 12, NULL,
         '88001', 32.3265, -106.7893, '{}', TRUE,
         TRUE, NULL, NULL, NULL),

        ('b0000002-0000-4000-8000-000000000003',
         'a0000001-0000-4000-8000-000000000001',
         'Sunflower Bouquet', 'Fresh-cut sunflowers, 5-stem bunches. Brighten up any room.',
         'flower', 800, 8, NULL,
         '88001', 32.3265, -106.7893, '{}', TRUE,
         TRUE, NULL, NULL, NULL),

        -- Maria Green (pickup only)
        ('b0000002-0000-4000-8000-000000000004',
         'a0000001-0000-4000-8000-000000000001',
         'Fresh Basil Bunches', 'Genovese basil, great for pesto. Pickup from front porch.',
         'other', 150, 20, NULL,
         '88001', 32.3265, -106.7893, '{}', TRUE,
         FALSE, '2026-04-26', '09:00', '412 Mesilla St, front porch, Las Cruces'),

        -- James Carter (pickup only, eggs)
        ('b0000002-0000-4000-8000-000000000005',
         'a0000001-0000-4000-8000-000000000002',
         'Free-Range Eggs (dozen)', 'Hens roam freely. Eggs collected daily. Mixed brown and white.',
         'egg', 600, 30, NULL,
         '88005', 32.3161, -106.7991, '{}', TRUE,
         FALSE, '2026-04-25', '08:00', '3886 Brook Haven Dr, side gate, Las Cruces'),

        ('b0000002-0000-4000-8000-000000000006',
         'a0000001-0000-4000-8000-000000000002',
         'Jalapeño Peppers', 'Freshly picked. Medium heat. Great for salsa or pickling.',
         'vegetable', 200, 25, NULL,
         '88005', 32.3161, -106.7991, '{}', TRUE,
         FALSE, '2026-04-26', '10:00', '3886 Brook Haven Dr, side gate, Las Cruces'),

        ('b0000002-0000-4000-8000-000000000007',
         'a0000001-0000-4000-8000-000000000002',
         'Honey from Backyard Hives', 'Raw, unfiltered local honey. 8 oz jar.',
         'other', 1200, 10, NULL,
         '88005', 32.3161, -106.7991, '{}', TRUE,
         TRUE, NULL, NULL, NULL),

        -- James Carter (exchange listing)
        ('b0000002-0000-4000-8000-000000000008',
         'a0000001-0000-4000-8000-000000000002',
         'Butternut Squash', 'Large squash, perfect for soup or roasting. Happy to trade!',
         'vegetable', NULL, 6, 'tomato seedlings or herb plants',
         '88005', 32.3161, -106.7991, '{}', TRUE,
         TRUE, NULL, NULL, NULL),

        -- Linda Torres (delivers)
        ('b0000002-0000-4000-8000-000000000009',
         'a0000001-0000-4000-8000-000000000003',
         'Lavender Bundles', 'Dried lavender from my garden. Lovely scent for home or gifts.',
         'flower', 500, 15, NULL,
         '88007', 32.2999, -106.7450, '{}', TRUE,
         TRUE, NULL, NULL, NULL),

        ('b0000002-0000-4000-8000-000000000010',
         'a0000001-0000-4000-8000-000000000003',
         'Mixed Herb Box', 'Rosemary, thyme, oregano, and mint — freshly cut.',
         'other', 350, 10, NULL,
         '88007', 32.2999, -106.7450, '{}', TRUE,
         TRUE, NULL, NULL, NULL),

        ('b0000002-0000-4000-8000-000000000011',
         'a0000001-0000-4000-8000-000000000003',
         'Strawberries (1 lb)', 'Sweet and ripe, picked same morning. Limited supply each week.',
         'fruit', 450, 14, NULL,
         '88007', 32.2999, -106.7450, '{}', TRUE,
         FALSE, '2026-04-27', '08:30', '209 Roadrunner Pkwy, mailbox end of driveway'),

        -- Linda Torres (draft — not yet published)
        ('b0000002-0000-4000-8000-000000000012',
         'a0000001-0000-4000-8000-000000000003',
         'Green Bell Peppers', 'Still growing — listing not ready yet.',
         'vegetable', 300, 0, NULL,
         '88007', 32.2999, -106.7450, '{}', FALSE,
         TRUE, NULL, NULL, NULL)

      ON CONFLICT (id) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('✓ Seed complete.');
    console.log('');
    console.log('Demo accounts (password: demo1234)');
    console.log('  Producers:');
    console.log('    maria.green@demo.com   — 4 listings (3 deliver, 1 pickup)');
    console.log('    james.farm@demo.com    — 4 listings (2 pickup, 1 deliver, 1 exchange)');
    console.log('    linda.garden@demo.com  — 4 listings (2 deliver, 1 pickup, 1 draft)');
    console.log('  Consumers:');
    console.log('    alex.buyer@demo.com');
    console.log('    sarah.shop@demo.com');
    console.log('    mike.local@demo.com');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  runSeed(pool)
    .then(() => pool.end())
    .catch(err => { console.error(err); process.exit(1); });
}
