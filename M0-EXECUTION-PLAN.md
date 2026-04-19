# M0 — Monorepo Scaffold + Contract-First Foundation
## Detailed Execution Plan

**Goal:** Running database, locked OpenAPI contract, and booted web app scaffold — before a single feature line is written.  
**Estimated effort:** 8–10 hours  
**Team split:** Dev A (backend/infra) · Dev B (OpenAPI spec + shared types + web scaffold)

---

## Prerequisites Checklist

Complete **before** starting the clock on M0.

| Tool | Required version | Check command |
|------|-----------------|---------------|
| Node.js | 20+ | `node -v` |
| npm | 10+ | `npm -v` |
| Docker Desktop | Any recent | `docker -v` |
| Git | Any | `git -v` |
| `psql` client | Any | `psql --version` (for manual checks) |

**API keys to provision:**

| Service | Where to get | .env key |
|---------|-------------|---------|
| Anthropic Claude | console.anthropic.com | `ANTHROPIC_API_KEY` |
| Stripe (sandbox) | dashboard.stripe.com | `STRIPE_SECRET_KEY` |
| SendGrid | app.sendgrid.com | `SENDGRID_API_KEY` |

> Keys can be placeholder strings for M0. They are not exercised until M3/M4.

---

## Phase 0 — Shared Setup (Both devs, ~30 min)

Both developers do this together before splitting.

### 0.1 — Initialize monorepo root

```bash
mkdir community-garden && cd community-garden
git init
```

Create `package.json`:

```json
{
  "name": "community-garden",
  "private": true,
  "workspaces": [
    "apps/web",
    "apps/mobile",
    "server",
    "packages/shared-types"
  ],
  "scripts": {
    "dev:web":    "npm -w apps/web run dev",
    "dev:server": "npm -w server run dev",
    "migrate":    "npm -w server run migrate",
    "seed":       "npm -w server run seed",
    "lint":       "npm -w server run lint && npm -w apps/web run lint",
    "typecheck":  "npm -w packages/shared-types run typecheck && npm -w server run typecheck && npm -w apps/web run typecheck"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

Create root `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

Create `.gitignore`:

```
node_modules/
dist/
build/
.env
*.local
.DS_Store
uploads/
coverage/
```

Create `.env.example` (commit this; never commit `.env`):

```
# Database
DATABASE_URL=postgresql://cg_user:cg_pass@localhost:5432/community_garden
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=change-me-in-production-minimum-32-chars
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_DAYS=30

# Payments
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder

# AI
ANTHROPIC_API_KEY=sk-ant-placeholder

# Email
SENDGRID_API_KEY=SG.placeholder

# App
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

Copy to local env file:

```bash
cp .env.example .env
```

Create scaffold directories:

```bash
mkdir -p apps/web apps/mobile server packages/shared-types
```

---

## Dev A Track — Server Scaffold + DB + Docker (~5 hours)

### A1 — Server package scaffold

```bash
cd server
npm init -y
```

Install runtime dependencies:

```bash
npm install express cors helmet dotenv pg redis bcryptjs jsonwebtoken uuid multer
npm install @anthropic-ai/sdk stripe @sendgrid/mail
npm install express-rate-limit express-validator
```

Install dev dependencies:

```bash
npm install -D typescript ts-node tsx nodemon \
  @types/express @types/node @types/pg @types/bcryptjs \
  @types/jsonwebtoken @types/uuid @types/multer \
  eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

Create `server/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "moduleResolution": "Node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Create `server/package.json` scripts section:

```json
{
  "scripts": {
    "dev":       "nodemon --exec tsx src/index.ts",
    "build":     "tsc",
    "start":     "node dist/index.js",
    "migrate":   "tsx src/db/migrate.ts",
    "seed":      "tsx src/db/seed.ts",
    "lint":      "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  }
}
```

### A2 — Server directory structure

```bash
mkdir -p server/src/{routes,services,middleware,db/{migrations,repositories},integrations,config}
```

Final structure:

```
server/src/
├── index.ts              ← Express app entry point
├── routes/
│   ├── auth.ts           ← stub (501) for M0
│   ├── listings.ts       ← GET / returns seeded data (M0 exit criterion)
│   ├── orders.ts         ← stub
│   ├── subscriptions.ts  ← stub
│   ├── exchanges.ts      ← stub
│   ├── futureOrders.ts   ← stub
│   ├── admin.ts          ← stub
│   └── ai.ts             ← stub
├── middleware/
│   └── errorHandler.ts
├── db/
│   ├── client.ts         ← pg Pool singleton
│   ├── migrate.ts        ← migration runner
│   ├── seed.ts           ← seed runner
│   └── migrations/       ← 7 SQL files
├── config/
│   └── env.ts            ← typed env loader
└── openapi.yaml          ← symlink or copy from root
```

### A3 — Docker Compose

Create `docker-compose.yml` at **repo root**:

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: cg_postgres
    environment:
      POSTGRES_USER: cg_user
      POSTGRES_PASSWORD: cg_pass
      POSTGRES_DB: community_garden
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cg_user -d community_garden"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: cg_redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pg_data:
```

Boot and verify:

```bash
docker compose up -d
docker compose ps            # both services should show "healthy"
```

### A4 — Database client singleton

Create `server/src/db/client.ts`:

```typescript
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params);

export default pool;
```

### A5 — Migration runner

Create `server/src/db/migrate.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import pool from './client';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const dir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1', [file]
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
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
```

### A6 — Migration files

Create all 7 migration files in `server/src/db/migrations/`:

---

**`001_create_users.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM (
  'consumer', 'producer', 'broker', 'admin'
);

CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  role          user_role   NOT NULL DEFAULT 'consumer',
  location_zip  TEXT,
  location_lat  DOUBLE PRECISION,
  location_lng  DOUBLE PRECISION,
  licensed      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role  ON users (role);
```

---

**`002_create_listings.sql`**

```sql
CREATE TYPE listing_category AS ENUM (
  'vegetable', 'fruit', 'flower', 'egg', 'other'
);

CREATE TABLE listings (
  id                 UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id        UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              TEXT             NOT NULL,
  description        TEXT,
  category           listing_category NOT NULL DEFAULT 'other',
  price_cents        INTEGER,           -- NULL = exchange only
  quantity_available INTEGER          NOT NULL DEFAULT 0,
  exchange_for       TEXT,
  location_zip       TEXT             NOT NULL,
  location_lat       DOUBLE PRECISION,
  location_lng       DOUBLE PRECISION,
  images             TEXT[]           NOT NULL DEFAULT '{}',
  is_available       BOOLEAN          NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listings_producer_id  ON listings (producer_id);
CREATE INDEX idx_listings_location_zip ON listings (location_zip);
CREATE INDEX idx_listings_category     ON listings (category);
CREATE INDEX idx_listings_is_available ON listings (is_available);
```

---

**`003_create_orders.sql`**

```sql
CREATE TYPE order_status AS ENUM (
  'pending', 'paid', 'fulfilled', 'cancelled'
);

CREATE TABLE orders (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id         UUID         NOT NULL REFERENCES users(id),
  status              order_status NOT NULL DEFAULT 'pending',
  subtotal_cents      INTEGER      NOT NULL,
  fee_percent         NUMERIC(5,2) NOT NULL,
  platform_fee_cents  INTEGER      NOT NULL,
  total_cents         INTEGER      NOT NULL,
  payment_ref         TEXT,
  stripe_payment_intent_id TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id      UUID    NOT NULL REFERENCES listings(id),
  quantity        INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL   -- snapshot at time of order
);

CREATE INDEX idx_orders_consumer_id ON orders (consumer_id);
CREATE INDEX idx_orders_status      ON orders (status);
CREATE INDEX idx_order_items_order  ON order_items (order_id);
```

---

**`004_create_subscriptions.sql`**

```sql
CREATE TYPE subscription_cadence AS ENUM ('weekly', 'biweekly', 'monthly');
CREATE TYPE subscription_status  AS ENUM ('active', 'paused', 'cancelled');

CREATE TABLE subscriptions (
  id              UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID                  NOT NULL REFERENCES users(id),
  listing_id      UUID                  NOT NULL REFERENCES listings(id),
  cadence         subscription_cadence  NOT NULL,
  status          subscription_status   NOT NULL DEFAULT 'active',
  stripe_sub_id   TEXT,
  next_billing_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_consumer ON subscriptions (consumer_id);
```

---

**`005_create_exchanges.sql`**

```sql
CREATE TYPE exchange_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE exchanges (
  id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id UUID            NOT NULL REFERENCES users(id),
  listing_id   UUID            NOT NULL REFERENCES listings(id),
  offered_item TEXT            NOT NULL,
  message      TEXT,
  status       exchange_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exchanges_listing ON exchanges (listing_id);
```

---

**`006_create_future_orders.sql`**

```sql
CREATE TYPE future_order_status AS ENUM ('open', 'matched', 'expired', 'cancelled');

CREATE TABLE future_orders (
  id                 UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id        UUID               NOT NULL REFERENCES users(id),
  product_query      TEXT               NOT NULL,  -- raw user text
  product_keyword    TEXT               NOT NULL,  -- parsed by AI
  category           listing_category,             -- nullable; AI-derived
  quantity_needed    NUMERIC(10,2)      NOT NULL,
  unit               TEXT               NOT NULL DEFAULT 'unit',
  max_price_cents    INTEGER,                      -- NULL = any price
  proximity_miles    INTEGER            NOT NULL DEFAULT 25,
  zip                TEXT               NOT NULL,
  expires_at         TIMESTAMPTZ        NOT NULL,
  status             future_order_status NOT NULL DEFAULT 'open',
  matched_listing_id UUID               REFERENCES listings(id),
  created_at         TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_future_orders_status     ON future_orders (status);
CREATE INDEX idx_future_orders_consumer   ON future_orders (consumer_id);
CREATE INDEX idx_future_orders_expires_at ON future_orders (expires_at);
CREATE INDEX idx_future_orders_keyword    ON future_orders USING gin (to_tsvector('english', product_keyword));
```

---

**`007_create_platform_config.sql`**

```sql
CREATE TABLE platform_config (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bootstrap with defaults
INSERT INTO platform_config (key, value) VALUES
  ('fee_percent',     '7'),
  ('max_radius_miles','100'),
  ('ai_search_enabled','true');
```

---

### A7 — Seed data

Create `server/src/db/seed.ts`:

```typescript
import pool from './client';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Two users (passwords are bcrypt of "password123")
    await client.query(`
      INSERT INTO users (id, email, password_hash, name, role, location_zip, location_lat, location_lng)
      VALUES
        ('a1b2c3d4-0000-0000-0000-000000000001',
         'alice@example.com',
         '$2b$10$rKN0HTYQ9z8VQZdJKlzJ7.3sXj5wY2vKpZjN1mXeU8GxKlRdF6X9K',
         'Alice (Producer)',
         'producer',
         '88001', 32.3265, -106.7893),
        ('a1b2c3d4-0000-0000-0000-000000000002',
         'bob@example.com',
         '$2b$10$rKN0HTYQ9z8VQZdJKlzJ7.3sXj5wY2vKpZjN1mXeU8GxKlRdF6X9K',
         'Bob (Consumer)',
         'consumer',
         '88001', 32.3165, -106.7793)
      ON CONFLICT DO NOTHING
    `);

    // Three listings
    await client.query(`
      INSERT INTO listings (id, producer_id, title, description, category, price_cents, quantity_available, location_zip, location_lat, location_lng, is_available)
      VALUES
        ('b1000000-0000-0000-0000-000000000001',
         'a1b2c3d4-0000-0000-0000-000000000001',
         'Fresh Zucchini',
         'Harvested this morning. No pesticides.',
         'vegetable', 300, 10, '88001', 32.3265, -106.7893, TRUE),

        ('b1000000-0000-0000-0000-000000000002',
         'a1b2c3d4-0000-0000-0000-000000000001',
         'Heirloom Tomatoes',
         'Cherokee Purple and Brandywine mix.',
         'vegetable', 450, 5, '88001', 32.3265, -106.7893, TRUE),

        ('b1000000-0000-0000-0000-000000000003',
         'a1b2c3d4-0000-0000-0000-000000000001',
         'Farm Fresh Eggs',
         'Free-range, collected daily.',
         'egg', 600, 20, '88001', 32.3265, -106.7893, TRUE)
      ON CONFLICT DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
```

### A8 — Express entry point with listings stub

Create `server/src/index.ts`:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import listingsRouter from './routes/listings';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/v1/listings', listingsRouter);

// Stubs (return 501 until implemented in later milestones)
const stub = (_req: express.Request, res: express.Response) =>
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in a future milestone' } });

app.use('/api/v1/auth',          stub);
app.use('/api/v1/orders',        stub);
app.use('/api/v1/subscriptions', stub);
app.use('/api/v1/exchanges',     stub);
app.use('/api/v1/future-orders', stub);
app.use('/api/v1/admin',         stub);
app.use('/api/v1/ai',            stub);

app.use(errorHandler);

app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
);
```

Create `server/src/routes/listings.ts` (M0 read-only stub — full CRUD in M2):

```typescript
import { Router } from 'express';
import { query } from '../db/client';

const router = Router();

// GET /api/v1/listings — returns all available listings (no auth required for M0)
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        id, title, description, category,
        price_cents, quantity_available,
        location_zip, images, is_available, created_at
      FROM listings
      WHERE is_available = TRUE
      ORDER BY created_at DESC
    `);
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
});

// All write endpoints are stubs in M0 — implemented in M2
router.post('/',           (_req, res) => res.status(501).json({ error: { code: 'NOT_IMPLEMENTED' } }));
router.get('/:id',         (_req, res) => res.status(501).json({ error: { code: 'NOT_IMPLEMENTED' } }));
router.put('/:id',         (_req, res) => res.status(501).json({ error: { code: 'NOT_IMPLEMENTED' } }));
router.delete('/:id',      (_req, res) => res.status(501).json({ error: { code: 'NOT_IMPLEMENTED' } }));
router.patch('/:id/publish',(_req, res) => res.status(501).json({ error: { code: 'NOT_IMPLEMENTED' } }));

export default router;
```

Create `server/src/middleware/errorHandler.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
  });
}
```

Create `server/src/config/env.ts`:

```typescript
function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const env = {
  databaseUrl:      required('DATABASE_URL'),
  redisUrl:         required('REDIS_URL'),
  jwtSecret:        required('JWT_SECRET'),
  stripeSecretKey:  process.env.STRIPE_SECRET_KEY ?? '',
  anthropicApiKey:  process.env.ANTHROPIC_API_KEY ?? '',
  sendgridApiKey:   process.env.SENDGRID_API_KEY ?? '',
  port:             parseInt(process.env.PORT ?? '3000'),
  nodeEnv:          process.env.NODE_ENV ?? 'development',
  corsOrigin:       process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
```

### A9 — Run and verify (Dev A exit check)

```bash
# From repo root
docker compose up -d
npm run migrate          # should print "apply 001…" through "apply 007…"
npm run seed             # should print "Seed complete."

# Verify DB contents
psql $DATABASE_URL -c "SELECT title, price_cents FROM listings;"

# Start server
npm run dev:server

# In a second terminal
curl http://localhost:3000/health
# → {"status":"ok"}

curl http://localhost:3000/api/v1/listings
# → {"data":[{"id":...,"title":"Fresh Zucchini",...}, ...], "total":3}
```

---

## Dev B Track — OpenAPI Spec + Shared Types + Web Scaffold (~5 hours)

### B1 — Shared types package

```bash
cd packages/shared-types
npm init -y
npm install -D typescript
```

Create `packages/shared-types/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

Create `packages/shared-types/package.json` (main + types):

```json
{
  "name": "@community-garden/types",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build":     "tsc",
    "typecheck": "tsc --noEmit"
  }
}
```

Create `packages/shared-types/src/index.ts` — all domain types:

```typescript
// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'consumer' | 'producer' | 'broker' | 'admin';
export type ListingCategory = 'vegetable' | 'fruit' | 'flower' | 'egg' | 'other';
export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'cancelled';
export type SubscriptionCadence = 'weekly' | 'biweekly' | 'monthly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type ExchangeStatus = 'pending' | 'accepted' | 'declined';
export type FutureOrderStatus = 'open' | 'matched' | 'expired' | 'cancelled';

// ─── Domain objects (match DB rows + camelCase) ───────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  locationZip?: string;
  locationLat?: number;
  locationLng?: number;
  licensed: boolean;
  createdAt: string;
}

export interface Listing {
  id: string;
  producerId: string;
  title: string;
  description?: string;
  category: ListingCategory;
  priceCents?: number;       // null = exchange only
  quantityAvailable: number;
  exchangeFor?: string;
  locationZip: string;
  locationLat?: number;
  locationLng?: number;
  images: string[];
  isAvailable: boolean;
  distanceMiles?: number;    // populated by search endpoints
  createdAt: string;
}

export interface OrderItem {
  id: string;
  listingId: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  id: string;
  consumerId: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotalCents: number;
  feePercent: number;
  platformFeeCents: number;
  totalCents: number;
  paymentRef?: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  consumerId: string;
  listingId: string;
  cadence: SubscriptionCadence;
  status: SubscriptionStatus;
  nextBillingAt?: string;
  createdAt: string;
}

export interface Exchange {
  id: string;
  initiatorId: string;
  listingId: string;
  offeredItem: string;
  message?: string;
  status: ExchangeStatus;
  createdAt: string;
}

export interface FutureOrder {
  id: string;
  consumerId: string;
  productQuery: string;
  productKeyword: string;
  category?: ListingCategory;
  quantityNeeded: number;
  unit: string;
  maxPriceCents?: number;
  proximityMiles: number;
  zip: string;
  expiresAt: string;
  status: FutureOrderStatus;
  matchedListingId?: string;
  createdAt: string;
}

export interface PlatformConfig {
  key: string;
  value: string;
  updatedAt: string;
}

// ─── API request / response shapes ────────────────────────────────────────────

export interface AuthRegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  locationZip?: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'createdAt'>;
}

export interface AISearchRequest {
  query: string;
  userZip?: string;
  radiusMiles?: number;
}

export interface AISearchResponse {
  intent: string;
  results: Listing[];
  explanation: string;
}

export interface AIParseDemandRequest {
  query: string;
  zip: string;
}

export interface AIParseDemandResponse {
  productKeyword: string;
  category?: ListingCategory;
  quantityNeeded: number;
  unit: string;
  maxPriceCents?: number;
  proximityMiles: number;
  expiresAt: string;       // ISO 8601
}

export interface CreateOrderRequest {
  items: { listingId: string; quantity: number }[];
}

export interface CreateOrderResponse {
  orderId: string;
  subtotalCents: number;
  feePercent: number;
  platformFeeCents: number;
  totalCents: number;
  stripeClientSecret: string;
}

// ─── API wrapper ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  total?: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

Build shared types:

```bash
cd packages/shared-types && npm run build
```

### B2 — OpenAPI 3.1 specification

Create `server/openapi.yaml`. This is the **source of truth** for all endpoint contracts. Write the full spec:

```yaml
openapi: 3.1.0
info:
  title: Community Garden API
  version: 1.0.0
  description: |
    Marketplace API for Community Garden — connecting local food producers
    with consumers. Supports AI-powered search, Future Orders (demand signals),
    Stripe payments, and SendGrid notifications.
  contact:
    name: Community Garden Team
    url: https://github.com/redwan1795/HACK-TECH-TALK

servers:
  - url: http://localhost:3000/api/v1
    description: Local development
  - url: https://api.community-garden.app/v1
    description: Production

tags:
  - name: auth
    description: Authentication and token management
  - name: users
    description: User profile management
  - name: listings
    description: Producer listing CRUD and search
  - name: orders
    description: Consumer checkout and order management
  - name: subscriptions
    description: Recurring produce subscriptions
  - name: exchanges
    description: Barter/exchange proposals
  - name: future-orders
    description: Consumer demand signals with proximity-based notifications
  - name: admin
    description: Platform configuration (operator only)
  - name: ai
    description: AI-powered search and demand parsing

# ─── Security scheme ──────────────────────────────────────────────────────────
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  # ─── Reusable schemas ────────────────────────────────────────────────────────
  schemas:

    UserRole:
      type: string
      enum: [consumer, producer, broker, admin]

    ListingCategory:
      type: string
      enum: [vegetable, fruit, flower, egg, other]

    User:
      type: object
      required: [id, email, name, role, licensed, createdAt]
      properties:
        id:          { type: string, format: uuid }
        email:       { type: string, format: email }
        name:        { type: string }
        role:        { $ref: '#/components/schemas/UserRole' }
        locationZip: { type: string }
        licensed:    { type: boolean }
        createdAt:   { type: string, format: date-time }

    Listing:
      type: object
      required: [id, producerId, title, category, quantityAvailable, locationZip, images, isAvailable, createdAt]
      properties:
        id:                 { type: string, format: uuid }
        producerId:         { type: string, format: uuid }
        title:              { type: string }
        description:        { type: string }
        category:           { $ref: '#/components/schemas/ListingCategory' }
        priceCents:         { type: integer, nullable: true, description: "null = exchange only" }
        quantityAvailable:  { type: integer }
        exchangeFor:        { type: string, nullable: true }
        locationZip:        { type: string }
        images:             { type: array, items: { type: string, format: uri } }
        isAvailable:        { type: boolean }
        distanceMiles:      { type: number, description: "Populated by search endpoints only" }
        createdAt:          { type: string, format: date-time }

    Order:
      type: object
      required: [id, consumerId, status, subtotalCents, feePercent, platformFeeCents, totalCents, createdAt]
      properties:
        id:                { type: string, format: uuid }
        consumerId:        { type: string, format: uuid }
        status:            { type: string, enum: [pending, paid, fulfilled, cancelled] }
        items:
          type: array
          items:
            type: object
            required: [id, listingId, quantity, unitPriceCents]
            properties:
              id:            { type: string, format: uuid }
              listingId:     { type: string, format: uuid }
              quantity:      { type: integer }
              unitPriceCents:{ type: integer }
        subtotalCents:     { type: integer }
        feePercent:        { type: number }
        platformFeeCents:  { type: integer }
        totalCents:        { type: integer }
        createdAt:         { type: string, format: date-time }

    FutureOrder:
      type: object
      required: [id, consumerId, productQuery, productKeyword, quantityNeeded, unit, proximityMiles, zip, expiresAt, status, createdAt]
      properties:
        id:               { type: string, format: uuid }
        consumerId:       { type: string, format: uuid }
        productQuery:     { type: string }
        productKeyword:   { type: string }
        category:         { $ref: '#/components/schemas/ListingCategory' }
        quantityNeeded:   { type: number }
        unit:             { type: string }
        maxPriceCents:    { type: integer, nullable: true }
        proximityMiles:   { type: integer }
        zip:              { type: string }
        expiresAt:        { type: string, format: date-time }
        status:           { type: string, enum: [open, matched, expired, cancelled] }
        matchedListingId: { type: string, format: uuid, nullable: true }
        createdAt:        { type: string, format: date-time }

    AISearchRequest:
      type: object
      required: [query]
      properties:
        query:       { type: string, minLength: 1, maxLength: 500 }
        userZip:     { type: string }
        radiusMiles: { type: integer, default: 25 }

    AISearchResponse:
      type: object
      required: [intent, results, explanation]
      properties:
        intent:      { type: string }
        results:
          type: array
          items: { $ref: '#/components/schemas/Listing' }
        explanation: { type: string }

    AIParseDemandResponse:
      type: object
      required: [productKeyword, quantityNeeded, unit, proximityMiles, expiresAt]
      properties:
        productKeyword:  { type: string }
        category:        { $ref: '#/components/schemas/ListingCategory' }
        quantityNeeded:  { type: number }
        unit:            { type: string }
        maxPriceCents:   { type: integer, nullable: true }
        proximityMiles:  { type: integer }
        expiresAt:       { type: string, format: date-time }

    Error:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties:
            code:    { type: string }
            message: { type: string }
            details: {}

  # ─── Reusable responses ──────────────────────────────────────────────────────
  responses:
    Unauthorized:
      description: Missing or invalid JWT
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    Forbidden:
      description: Authenticated but insufficient role
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    NotImplemented:
      description: Endpoint not yet implemented (P1/P2 stubs)
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }

# ─── Paths ────────────────────────────────────────────────────────────────────
paths:

  # ── Auth ────────────────────────────────────────────────────────────────────
  /auth/register:
    post:
      tags: [auth]
      summary: Register a new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password, name, role]
              properties:
                email:       { type: string, format: email }
                password:    { type: string, minLength: 8 }
                name:        { type: string }
                role:        { $ref: '#/components/schemas/UserRole' }
                locationZip: { type: string }
      responses:
        "201":
          description: User registered
          content:
            application/json:
              schema:
                type: object
                properties:
                  accessToken:  { type: string }
                  refreshToken: { type: string }
                  user:         { $ref: '#/components/schemas/User' }
        "409":
          description: Email already in use
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }

  /auth/login:
    post:
      tags: [auth]
      summary: Log in and receive tokens
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:    { type: string, format: email }
                password: { type: string }
      responses:
        "200":
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  accessToken:  { type: string }
                  refreshToken: { type: string }
                  user:         { $ref: '#/components/schemas/User' }
        "401":
          description: Invalid credentials
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }

  /auth/refresh:
    post:
      tags: [auth]
      summary: Rotate refresh token and issue new access token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [refreshToken]
              properties:
                refreshToken: { type: string }
      responses:
        "200":
          description: New tokens issued
          content:
            application/json:
              schema:
                type: object
                properties:
                  accessToken:  { type: string }
                  refreshToken: { type: string }
        "401": { $ref: '#/components/responses/Unauthorized' }

  /auth/logout:
    post:
      tags: [auth]
      summary: Invalidate refresh token
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [refreshToken]
              properties:
                refreshToken: { type: string }
      responses:
        "204":
          description: Logged out

  # ── Users ───────────────────────────────────────────────────────────────────
  /users/me:
    get:
      tags: [users]
      summary: Get current user profile
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Current user
          content:
            application/json:
              schema: { $ref: '#/components/schemas/User' }
        "401": { $ref: '#/components/responses/Unauthorized' }
    patch:
      tags: [users]
      summary: Update current user profile
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:        { type: string }
                locationZip: { type: string }
      responses:
        "200":
          description: Updated user
          content:
            application/json:
              schema: { $ref: '#/components/schemas/User' }
        "401": { $ref: '#/components/responses/Unauthorized' }

  # ── Listings ─────────────────────────────────────────────────────────────────
  /listings:
    get:
      tags: [listings]
      summary: Search and browse listings
      parameters:
        - in: query
          name: q
          schema: { type: string }
          description: Keyword search against title and description
        - in: query
          name: zip
          schema: { type: string }
          description: ZIP code anchor for proximity filtering
        - in: query
          name: radius_miles
          schema: { type: integer, default: 25 }
        - in: query
          name: category
          schema: { $ref: '#/components/schemas/ListingCategory' }
        - in: query
          name: max_price_cents
          schema: { type: integer }
        - in: query
          name: allow_exchange
          schema: { type: boolean }
        - in: query
          name: page
          schema: { type: integer, default: 1 }
        - in: query
          name: limit
          schema: { type: integer, default: 20, maximum: 100 }
      responses:
        "200":
          description: Paginated listing results
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:  { type: array, items: { $ref: '#/components/schemas/Listing' } }
                  total: { type: integer }
                  page:  { type: integer }
                  limit: { type: integer }

    post:
      tags: [listings]
      summary: Create a new listing (producer only)
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [title, category, quantityAvailable, locationZip]
              properties:
                title:             { type: string }
                description:       { type: string }
                category:          { $ref: '#/components/schemas/ListingCategory' }
                priceCents:        { type: integer }
                quantityAvailable: { type: integer }
                exchangeFor:       { type: string }
                locationZip:       { type: string }
                images:
                  type: array
                  items: { type: string, format: binary }
      responses:
        "201":
          description: Listing created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Listing' }
        "401": { $ref: '#/components/responses/Unauthorized' }
        "403": { $ref: '#/components/responses/Forbidden' }

  /listings/{id}:
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: string, format: uuid }
    get:
      tags: [listings]
      summary: Get a single listing by ID
      responses:
        "200":
          description: Listing detail
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Listing' }
        "404": { $ref: '#/components/responses/NotFound' }
    put:
      tags: [listings]
      summary: Update listing (producer only — own listings)
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema: { $ref: '#/components/schemas/Listing' }
      responses:
        "200":
          description: Updated listing
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Listing' }
        "401": { $ref: '#/components/responses/Unauthorized' }
        "403": { $ref: '#/components/responses/Forbidden' }
        "404": { $ref: '#/components/responses/NotFound' }
    delete:
      tags: [listings]
      summary: Soft-delete listing (producer only — own listings)
      security:
        - bearerAuth: []
      responses:
        "204":
          description: Deleted
        "401": { $ref: '#/components/responses/Unauthorized' }
        "403": { $ref: '#/components/responses/Forbidden' }

  /listings/{id}/publish:
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: string, format: uuid }
    patch:
      tags: [listings]
      summary: Publish or unpublish a listing
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [isAvailable]
              properties:
                isAvailable: { type: boolean }
      responses:
        "200":
          description: Listing availability updated
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Listing' }
        "401": { $ref: '#/components/responses/Unauthorized' }
        "403": { $ref: '#/components/responses/Forbidden' }

  # ── Orders ───────────────────────────────────────────────────────────────────
  /orders:
    get:
      tags: [orders]
      summary: List orders for current user
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Order list
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Order' } }
        "401": { $ref: '#/components/responses/Unauthorized' }
    post:
      tags: [orders]
      summary: Create order and Stripe PaymentIntent
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [items]
              properties:
                items:
                  type: array
                  minItems: 1
                  items:
                    type: object
                    required: [listingId, quantity]
                    properties:
                      listingId: { type: string, format: uuid }
                      quantity:  { type: integer, minimum: 1 }
      responses:
        "201":
          description: Order created with Stripe client secret
          content:
            application/json:
              schema:
                type: object
                properties:
                  orderId:            { type: string, format: uuid }
                  subtotalCents:      { type: integer }
                  feePercent:         { type: number }
                  platformFeeCents:   { type: integer }
                  totalCents:         { type: integer }
                  stripeClientSecret: { type: string }
        "401": { $ref: '#/components/responses/Unauthorized' }
        "422":
          description: Insufficient stock or listing unavailable
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }

  /orders/{id}/confirm:
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: string, format: uuid }
    post:
      tags: [orders]
      summary: Confirm payment and decrement stock
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Order confirmed and stock decremented
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Order' }
        "401": { $ref: '#/components/responses/Unauthorized' }
        "404": { $ref: '#/components/responses/NotFound' }

  # ── Subscriptions (P1 stub) ──────────────────────────────────────────────────
  /subscriptions:
    post:
      tags: [subscriptions]
      summary: Create a recurring subscription (P1)
      security:
        - bearerAuth: []
      responses:
        "501": { $ref: '#/components/responses/NotImplemented' }
    get:
      tags: [subscriptions]
      summary: List subscriptions for current user (P1)
      security:
        - bearerAuth: []
      responses:
        "501": { $ref: '#/components/responses/NotImplemented' }

  # ── Exchanges (P2 stub) ──────────────────────────────────────────────────────
  /exchanges:
    post:
      tags: [exchanges]
      summary: Propose a barter exchange (P2)
      security:
        - bearerAuth: []
      responses:
        "501": { $ref: '#/components/responses/NotImplemented' }

  # ── Future Orders ────────────────────────────────────────────────────────────
  /future-orders:
    get:
      tags: [future-orders]
      summary: List current user's demand signals
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Future orders list
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/FutureOrder' } }
        "401": { $ref: '#/components/responses/Unauthorized' }
    post:
      tags: [future-orders]
      summary: Save confirmed demand signal as open
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [productQuery, productKeyword, quantityNeeded, unit, proximityMiles, zip, expiresAt]
              properties:
                productQuery:   { type: string }
                productKeyword: { type: string }
                category:       { $ref: '#/components/schemas/ListingCategory' }
                quantityNeeded: { type: number }
                unit:           { type: string }
                maxPriceCents:  { type: integer }
                proximityMiles: { type: integer, default: 25 }
                zip:            { type: string }
                expiresAt:      { type: string, format: date-time }
      responses:
        "201":
          description: Future order saved
          content:
            application/json:
              schema: { $ref: '#/components/schemas/FutureOrder' }
        "401": { $ref: '#/components/responses/Unauthorized' }

  /future-orders/{id}:
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: string, format: uuid }
    delete:
      tags: [future-orders]
      summary: Cancel an open demand signal
      security:
        - bearerAuth: []
      responses:
        "204":
          description: Cancelled
        "401": { $ref: '#/components/responses/Unauthorized' }
        "403": { $ref: '#/components/responses/Forbidden' }

  # ── Admin ────────────────────────────────────────────────────────────────────
  /admin/config:
    get:
      tags: [admin]
      summary: Get platform configuration (public read — used by cart to display fee)
      responses:
        "200":
          description: Config values
          content:
            application/json:
              schema:
                type: object
                additionalProperties: { type: string }
    patch:
      tags: [admin]
      summary: Update platform config (admin only)
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                feePercent: { type: number, minimum: 0, maximum: 100 }
      responses:
        "200":
          description: Updated config
          content:
            application/json:
              schema:
                type: object
                additionalProperties: { type: string }
        "401": { $ref: '#/components/responses/Unauthorized' }
        "403": { $ref: '#/components/responses/Forbidden' }

  # ── AI ───────────────────────────────────────────────────────────────────────
  /ai/search:
    post:
      tags: [ai]
      summary: Natural-language product search (FR-08, P0)
      description: |
        Sends user prompt to Claude with `search_listings` tool definition.
        Claude extracts structured intent; server executes listing search and
        returns ranked results with a short human-readable explanation.
        Falls back to keyword search if Claude is unavailable.
        Rate-limited: 20 requests / user / hour.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AISearchRequest' }
      responses:
        "200":
          description: AI search results
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AISearchResponse' }
        "401": { $ref: '#/components/responses/Unauthorized' }
        "429":
          description: Rate limit exceeded (20 req/user/hour)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }

  /ai/parse-demand:
    post:
      tags: [ai]
      summary: Parse free-text demand intent for Future Orders (FR-11, P1)
      description: |
        Sends user prompt to Claude with `create_future_order` tool definition.
        Returns structured intent for consumer to review before confirming.
        Does NOT save to DB — the client calls POST /future-orders to persist.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [query, zip]
              properties:
                query: { type: string, minLength: 1, maxLength: 500 }
                zip:   { type: string }
      responses:
        "200":
          description: Parsed demand intent
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AIParseDemandResponse' }
        "401": { $ref: '#/components/responses/Unauthorized' }
        "403": { $ref: '#/components/responses/Forbidden' }
```

Validate the spec:

```bash
npm install -g @redocly/cli
redocly lint server/openapi.yaml
# Must report: 0 errors, 0 warnings
```

> If `redocly` is unavailable, use `npx @apidevtools/swagger-parser validate server/openapi.yaml`.

### B3 — Web app scaffold

```bash
cd apps/web
npm create vite@latest . -- --template react-ts
npm install
```

Install app dependencies:

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install zustand
npm install react-router-dom
npm install axios
npm install @community-garden/types@*
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Configure `apps/web/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        garden: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          900: '#14532d',
        },
      },
    },
  },
  plugins: [],
};
```

Update `apps/web/src/index.css` to include Tailwind directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `apps/web/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <ReactQueryDevtools />
    </QueryClientProvider>
  </React.StrictMode>
);
```

Create `apps/web/src/App.tsx` (placeholder routing — pages filled in M1/M2/M3):

```tsx
import { Routes, Route } from 'react-router-dom';

function PlaceholderPage({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-garden-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-garden-700">🌱 Community Garden</h1>
        <p className="mt-2 text-gray-500">{name} — coming in a future milestone</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/"            element={<PlaceholderPage name="AI Search (M3)" />} />
      <Route path="/browse"      element={<PlaceholderPage name="Browse Listings (M2)" />} />
      <Route path="/cart"        element={<PlaceholderPage name="Cart (M3)" />} />
      <Route path="/orders"      element={<PlaceholderPage name="Orders (M3)" />} />
      <Route path="/future"      element={<PlaceholderPage name="Future Orders (M4)" />} />
      <Route path="/dashboard"   element={<PlaceholderPage name="Producer Dashboard (M2)" />} />
      <Route path="/login"       element={<PlaceholderPage name="Login (M1)" />} />
      <Route path="/register"    element={<PlaceholderPage name="Register (M1)" />} />
      <Route path="*"            element={<PlaceholderPage name="404 — Not Found" />} />
    </Routes>
  );
}
```

Create API client `apps/web/src/lib/api.ts`:

```typescript
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Create `apps/web/.env.local`:

```
VITE_API_URL=http://localhost:3000/api/v1
```

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "outDir": "./dist",
    "noEmit": true
  },
  "include": ["src"]
}
```

Add scripts to `apps/web/package.json`:

```json
{
  "scripts": {
    "dev":       "vite",
    "build":     "tsc && vite build",
    "lint":      "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "preview":   "vite preview"
  }
}
```

Boot the web app and verify:

```bash
npm run dev:web
# Open http://localhost:5173
# Should show green placeholder page with "🌱 Community Garden"
# Browser console: 0 errors
```

### B4 — Mobile scaffold (dormant)

```bash
cd apps/mobile
npx create-expo-app@latest . --template blank-typescript
```

Add a note in `apps/mobile/README.md`:

```
Mobile app scaffold — dormant until M5.
Do not add feature code here before both demo scenarios pass on web.
```

---

## Integration + Verification (Both devs, ~30 min)

### Exit criterion checklist

Run through each check in order. All must pass before M0 is declared done.

```bash
# 1. Infrastructure
docker compose ps
# EXPECTED: cg_postgres → healthy, cg_redis → healthy

# 2. Database
npm run migrate
# EXPECTED: "apply 001_create_users.sql" through "apply 007_..."
#           "Migrations complete."

npm run seed
# EXPECTED: "Seed complete."

# Manual spot-check
psql $DATABASE_URL -c "SELECT title, is_available FROM listings;"
# EXPECTED: 3 rows (Zucchini, Heirloom Tomatoes, Farm Fresh Eggs), all is_available = true

# 3. Server health
npm run dev:server &
curl http://localhost:3000/health
# EXPECTED: {"status":"ok"}

# 4. M0 exit criterion — GET /api/v1/listings returns seeded data
curl -s http://localhost:3000/api/v1/listings | python3 -m json.tool
# EXPECTED: {"data": [...3 listings...], "total": 3}

# 5. Stub endpoints return 501 (not 404)
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/v1/auth/login
# EXPECTED: 501

# 6. OpenAPI lint
redocly lint server/openapi.yaml
# EXPECTED: 0 errors, 0 warnings

# 7. Shared types compile
npm -w packages/shared-types run build
# EXPECTED: no TypeScript errors

# 8. Web app
npm run dev:web &
# Open http://localhost:5173 → green placeholder page, 0 console errors
```

---

## File Tree — M0 Complete State

```
community-garden/
├── .env                          ← local only, gitignored
├── .env.example                  ← committed
├── .gitignore
├── docker-compose.yml
├── package.json                  ← workspace root
├── tsconfig.base.json
│
├── packages/
│   └── shared-types/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts          ← all domain types + API shapes
│
├── server/
│   ├── openapi.yaml              ← full OpenAPI 3.1 spec
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── config/
│       │   └── env.ts
│       ├── middleware/
│       │   └── errorHandler.ts
│       ├── routes/
│       │   ├── listings.ts       ← GET / live; all writes → 501
│       │   └── (other routes)    ← all → 501 stub
│       └── db/
│           ├── client.ts
│           ├── migrate.ts
│           ├── seed.ts
│           └── migrations/
│               ├── 001_create_users.sql
│               ├── 002_create_listings.sql
│               ├── 003_create_orders.sql
│               ├── 004_create_subscriptions.sql
│               ├── 005_create_exchanges.sql
│               ├── 006_create_future_orders.sql
│               └── 007_create_platform_config.sql
│
├── apps/
│   ├── web/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   ├── .env.local
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx           ← placeholder routes only
│   │       ├── index.css
│   │       └── lib/
│   │           └── api.ts        ← axios client
│   └── mobile/
│       └── App.tsx               ← Expo scaffold, dormant
│
└── (documentation files)
    ├── README.md
    ├── ARCHITECTURE.md
    ├── REQUIREMENTS.md
    ├── BUILD-PROMPT.md
    ├── MILESTONES.md
    ├── TEST-PLAN.md
    ├── M0-EXECUTION-PLAN.md      ← this file
    └── diagrams/
```

---

## Parallel Work Summary

| Dev | Focus | Hours |
|-----|-------|-------|
| Dev A | Docker + DB migrations + server scaffold + `GET /listings` live | ~5h |
| Dev B | OpenAPI spec + shared-types + Vite + React + Tailwind scaffold | ~5h |
| Both | Prerequisites + repo init + integration smoke tests | ~1h |

Dev A and Dev B can work simultaneously from step **Phase 0** onward. The only synchronization point is at the end: both run the integration checklist together.

---

## Common Issues & Fixes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `docker compose up` postgres not healthy | Port 5432 in use | `lsof -i :5432`, stop conflicting Postgres service |
| `npm run migrate` — "relation does not exist" | `DATABASE_URL` not loaded | Ensure `.env` is populated and `dotenv/config` is imported at top of `migrate.ts` |
| `redocly lint` — "must be object" | YAML indentation error | Use a YAML linter / formatter (e.g. Prettier with `yaml` plugin) |
| Vite dev server — "Cannot find module @community-garden/types" | Types package not built | Run `npm -w packages/shared-types run build` then restart dev server |
| `GET /listings` returns 500 | pg Pool can't connect | Verify `DATABASE_URL` in `.env`, verify Docker is running |

---

## Handoff to M1

When all 8 exit criterion checks above pass, M0 is done. Update `MILESTONES.md` status badge for M0 from `⬜ Not started` to `✅ Done` and start M1.

M1 entry state guaranteed by M0:
- `users` table exists and is empty (except seed rows)
- `POST /auth/*` endpoints exist as stubs (501)
- Shared type `AuthRegisterRequest`, `AuthLoginRequest`, `AuthTokenResponse` already defined
- `apiClient` configured and importable in the web app
