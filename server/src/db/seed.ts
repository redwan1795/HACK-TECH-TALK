import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

export async function runSeed(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash('password123', 10);
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO users
        (id, email, password_hash, name, role, location_zip, location_lat, location_lng)
      VALUES
        ('a1b2c3d4-0000-0000-0000-000000000001',
         'alice@example.com', $1, 'Alice (Producer)', 'producer',
         '88001', 32.3265, -106.7893),
        ('a1b2c3d4-0000-0000-0000-000000000002',
         'bob@example.com',   $1, 'Bob (Consumer)',   'consumer',
         '88001', 32.3165, -106.7793)
      ON CONFLICT DO NOTHING
    `, [passwordHash]);

    await client.query(`
      INSERT INTO listings
        (id, producer_id, title, description, category,
         price_cents, quantity_available, location_zip,
         location_lat, location_lng, is_available)
      VALUES
        ('b1000000-0000-0000-0000-000000000001',
         'a1b2c3d4-0000-0000-0000-000000000001',
         'Fresh Zucchini', 'Harvested this morning. No pesticides.',
         'vegetable', 300, 10, '88001', 32.3265, -106.7893, TRUE),

        ('b1000000-0000-0000-0000-000000000002',
         'a1b2c3d4-0000-0000-0000-000000000001',
         'Heirloom Tomatoes', 'Cherokee Purple and Brandywine mix.',
         'vegetable', 450, 5, '88001', 32.3265, -106.7893, TRUE),

        ('b1000000-0000-0000-0000-000000000003',
         'a1b2c3d4-0000-0000-0000-000000000001',
         'Farm Fresh Eggs', 'Free-range, collected daily.',
         'egg', 600, 20, '88001', 32.3265, -106.7893, TRUE)
      ON CONFLICT DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Run directly: tsx src/db/seed.ts
if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  runSeed(pool)
    .then(() => pool.end())
    .catch(err => { console.error(err); process.exit(1); });
}
