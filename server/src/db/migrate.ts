import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename   TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const dir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1',
        [file]
      );
      if (rowCount && rowCount > 0) {
        console.log(`  skip  ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  apply ${file}`);
    }
    console.log('Migrations complete.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Run directly: tsx src/db/migrate.ts
if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  runMigrations(pool)
    .then(() => pool.end())
    .catch(err => { console.error(err); process.exit(1); });
}
