import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from '../src/db/pool';

async function main() {
  const migrationsDir = path.join(__dirname, '..', 'src', 'db', 'migrations');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query(
      'SELECT 1 FROM _migrations WHERE filename = $1',
      [file]
    );

    if (rows.length > 0) {
      console.log(`  ⏭  ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✓  ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ✗  ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log('\n✅ Migrations complete.');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
