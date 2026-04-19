import path from 'path';
import dotenv from 'dotenv';

// Load test env vars before any module imports resolve process.env
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

// Ensure DATABASE_URL is set (may be overridden by .env.test)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL_TEST ??
    'postgresql://cg_user:cg_pass@localhost:5432/community_garden_test';
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-minimum-32-chars-long!!';
}
