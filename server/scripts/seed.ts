import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool';

async function main() {
  console.log('🌱 Seeding demo data...');

  // Clear in dependency order
  await pool.query('DELETE FROM exchanges');
  await pool.query('DELETE FROM future_orders');
  await pool.query('DELETE FROM order_items');
  await pool.query('DELETE FROM orders');
  await pool.query('DELETE FROM listings');
  await pool.query("DELETE FROM users WHERE email LIKE '%@demo.local'");
  await pool.query('DELETE FROM platform_config');

  // Platform config
  await pool.query(
    `INSERT INTO platform_config (key, value) VALUES
       ('fee_percent', '7')`
  );

  const passwordHash = await bcrypt.hash('password123', 10);

  // Producers
  const { rows: producers } = await pool.query(
    `INSERT INTO users (email, password_hash, role, display_name, location_zip, location_lat, location_lng, licensed)
     VALUES
       ('maria@demo.local',  $1, 'producer_farmer', 'Maria''s Garden',      '88001', 32.3199, -106.7637, TRUE),
       ('casa@demo.local',   $1, 'producer_farmer', 'Casa Verde Orchard',   '88001', 32.3450, -106.7500, TRUE),
       ('sunny@demo.local',  $1, 'producer_home',   'Sunny Acres',          '88005', 32.2800, -106.7800, FALSE),
       ('herb@demo.local',   $1, 'producer_home',   'Herb Haven Garden',    '88001', 32.3100, -106.7700, FALSE)
     RETURNING id, display_name`,
    [passwordHash]
  );

  // Consumer + broker + admin
  await pool.query(
    `INSERT INTO users (email, password_hash, role, display_name, location_zip, location_lat, location_lng)
     VALUES
       ('consumer@demo.local', $1, 'consumer', 'Demo Consumer', '88001', 32.3199, -106.7637),
       ('broker@demo.local',   $1, 'broker',   'Sunrise Foods', '88001', 32.3199, -106.7637),
       ('admin@demo.local',    $1, 'operator', 'Admin',         '88001', 32.3199, -106.7637)`,
    [passwordHash]
  );

  const maria = producers.find((p) => p.display_name === "Maria's Garden")!;
  const casa  = producers.find((p) => p.display_name === 'Casa Verde Orchard')!;
  const sunny = producers.find((p) => p.display_name === 'Sunny Acres')!;
  const herb  = producers.find((p) => p.display_name === 'Herb Haven Garden')!;

  // Listings — include one exchange-only
  await pool.query(
    `INSERT INTO listings (producer_id, title, description, category, price_cents, unit, quantity_available, exchange_for, location_zip, location_lat, location_lng)
     VALUES
       ($1, 'Fresh Zucchini',     'Organic green zucchini, picked this morning.',  'vegetable', 300, 'lb',    8,  NULL, '88001', 32.3199, -106.7637),
       ($1, 'Heirloom Tomatoes',  'Vine-ripened heirloom tomatoes.',               'vegetable', 450, 'lb',    5,  NULL, '88001', 32.3199, -106.7637),
       ($2, 'Navel Oranges',      'Sweet navel oranges from our family orchard.',  'fruit',     250, 'lb',    15, NULL, '88001', 32.3450, -106.7500),
       ($3, 'Farm Fresh Eggs',    'Free-range brown eggs, dozen.',                 'egg',       600, 'dozen', 12, NULL, '88005', 32.2800, -106.7800),
       ($3, 'Rainbow Chard',      'Colorful rainbow chard, fresh cut.',            'vegetable', 350, 'bunch', 6,  NULL, '88005', 32.2800, -106.7800),
       ($4, 'Purple Basil Bundle','Aromatic purple basil, exchange only',           'herb',      NULL,'bunch', 4,  'tomatoes, eggs, or seedlings', '88001', 32.3100, -106.7700)`,
    [maria.id, casa.id, sunny.id, herb.id]
  );

  const { rows: counts } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users)           AS users,
      (SELECT COUNT(*) FROM listings)        AS listings,
      (SELECT COUNT(*) FROM platform_config) AS config
  `);

  console.log('   Users:    ', counts[0].users);
  console.log('   Listings: ', counts[0].listings);
  console.log('   Config:   ', counts[0].config);
  console.log('\n✅ Seed complete.');
  console.log('   Demo accounts (all password: password123):');
  console.log('     consumer@demo.local    (consumer)');
  console.log('     maria@demo.local       (producer_farmer)');
  console.log('     casa@demo.local        (producer_farmer)');
  console.log('     sunny@demo.local       (producer_home)');
  console.log('     herb@demo.local        (producer_home)');
  console.log('     broker@demo.local      (broker)');
  console.log('     admin@demo.local       (operator)  ← admin page');

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
