# M1 — Authentication + Role System
## Detailed Execution Plan

**Goal:** JWT-based auth with `consumer`, `producer`, `broker`, and `admin` roles gating all write endpoints from day one.  
**Estimated effort:** 8–10 hours  
**Team split:** Dev A (backend: auth routes, middleware, Redis) · Dev B (frontend: auth store, login/register pages, protected routes)

---

## Entry Criteria (verify before starting)

```bash
# 1. Docker services healthy
docker compose ps
# EXPECTED: cg_postgres → healthy, cg_redis → healthy

# 2. DB populated
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
# EXPECTED: 2 rows (Alice producer, Bob consumer from seed)

# 3. M0 smoke test still passes
curl http://localhost:3000/api/v1/listings
# EXPECTED: {"data":[...3 listings...], "total":3}

# 4. Auth endpoints currently return 501
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/v1/auth/login
# EXPECTED: 501
```

All 4 must pass. If any fail, resolve the M0 regression first.

---

## Phase 0 — Shared Setup (Both devs, ~15 min)

### 0.1 — Install missing server dependencies

```bash
cd server
npm install ioredis express-rate-limit
npm install -D @types/ioredis
```

> `bcryptjs`, `jsonwebtoken`, `uuid`, and their types were already installed in M0.

### 0.2 — Verify `.env` has all required keys

Open `.env` and confirm these are set (non-placeholder values for local dev):

```
JWT_SECRET=change-me-in-production-minimum-32-chars
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_DAYS=30
REDIS_URL=redis://localhost:6379
```

`JWT_SECRET` must be at least 32 characters. Generate one if needed:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 0.3 — Create new directories

```bash
mkdir -p server/src/services
```

`server/src/routes/` and `server/src/middleware/` already exist from M0.

---

## Dev A Track — Backend Auth (~5 hours)

### A1 — Redis client singleton

Create `server/src/db/redis.ts`:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

redis.on('error', (err) => console.error('Redis error:', err));

export default redis;
```

### A2 — Update env config

Update `server/src/config/env.ts` to expose JWT config:

```typescript
function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const env = {
  databaseUrl:           required('DATABASE_URL'),
  redisUrl:              required('REDIS_URL'),
  jwtSecret:             required('JWT_SECRET'),
  jwtAccessTtlSeconds:   parseInt(process.env.JWT_ACCESS_TTL_SECONDS ?? '900'),
  jwtRefreshTtlDays:     parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '30'),
  stripeSecretKey:       process.env.STRIPE_SECRET_KEY ?? '',
  anthropicApiKey:       process.env.ANTHROPIC_API_KEY ?? '',
  sendgridApiKey:        process.env.SENDGRID_API_KEY ?? '',
  port:                  parseInt(process.env.PORT ?? '3000'),
  nodeEnv:               process.env.NODE_ENV ?? 'development',
  corsOrigin:            process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
```

### A3 — Token service

Create `server/src/services/tokenService.ts`:

```typescript
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import redis from '../db/redis';
import { env } from '../config/env';
import type { UserRole } from '@community-garden/types';

export interface TokenPayload {
  sub: string;       // user id
  email: string;
  role: UserRole;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtAccessTtlSeconds,
  });
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomUUID();
  const ttlSeconds = env.jwtRefreshTtlDays * 86400;
  await redis.set(`refresh:${token}`, userId, 'EX', ttlSeconds);
  return token;
}

export async function rotateRefreshToken(
  oldToken: string
): Promise<{ userId: string; newToken: string } | null> {
  const userId = await redis.getdel(`refresh:${oldToken}`);
  if (!userId) return null;
  const newToken = await issueRefreshToken(userId);
  return { userId, newToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await redis.del(`refresh:${token}`);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}
```

### A4 — Authentication middleware

Create `server/src/middleware/authenticate.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../services/tokenService';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' },
    });
  }
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired' },
    });
  }
}
```

### A5 — Authorization middleware

Create `server/src/middleware/authorize.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@community-garden/types';

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of: ${roles.join(', ')}`,
        },
      });
    }
    next();
  };
}
```

### A6 — Rate limiter middleware

Create `server/src/middleware/rateLimiter.ts`:

```typescript
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { env } from '../config/env';

// Simple Redis store compatible with express-rate-limit v7
class RedisStore {
  private redis: Redis;
  private prefix: string;
  constructor(redis: Redis, prefix = 'rl:') {
    this.redis = redis;
    this.prefix = prefix;
  }
  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = `${this.prefix}${key}`;
    const hits = await this.redis.incr(redisKey);
    if (hits === 1) await this.redis.expire(redisKey, 60); // 60s window
    const ttl = await this.redis.ttl(redisKey);
    return { totalHits: hits, resetTime: new Date(Date.now() + ttl * 1000) };
  }
  async decrement(key: string): Promise<void> {
    await this.redis.decr(`${this.prefix}${key}`);
  }
  async resetKey(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}${key}`);
  }
}

const redisClient = new Redis(env.redisUrl);

export const authRateLimiter = rateLimit({
  windowMs: 60_000,       // 1 minute
  max: 10,                // 10 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore(redisClient, 'rl:auth:') as any,
  handler: (_req, res) =>
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down.' },
    }),
});
```

### A7 — Auth route handler

Create `server/src/routes/auth.ts`:

```typescript
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { query } from '../db/client';
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../services/tokenService';
import { authRateLimiter } from '../middleware/rateLimiter';
import { authenticate } from '../middleware/authenticate';
import type { UserRole } from '@community-garden/types';

const router = Router();

// ── POST /auth/register ───────────────────────────────────────────────────────
router.post(
  '/register',
  authRateLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').notEmpty().trim(),
  body('role').isIn(['consumer', 'producer', 'broker']),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    }

    const { email, password, name, role, locationZip } = req.body as {
      email: string; password: string; name: string;
      role: UserRole; locationZip?: string;
    };

    try {
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rowCount && existing.rowCount > 0) {
        return res.status(409).json({ error: { code: 'EMAIL_IN_USE', message: 'Email already registered' } });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const { rows } = await query(
        `INSERT INTO users (email, password_hash, name, role, location_zip)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, role, location_zip AS "locationZip", licensed, created_at AS "createdAt"`,
        [email, passwordHash, name, role, locationZip ?? null]
      );
      const user = rows[0];

      const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
      const refreshToken = await issueRefreshToken(user.id);

      return res.status(201).json({ accessToken, refreshToken, user });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post(
  '/login',
  authRateLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    }

    const { email, password } = req.body as { email: string; password: string };

    try {
      const { rows } = await query(
        `SELECT id, email, password_hash, name, role, location_zip AS "locationZip", licensed, created_at AS "createdAt"
         FROM users WHERE email = $1`,
        [email]
      );
      if (rows.length === 0) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      }
      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      }

      const { password_hash: _, ...safeUser } = user;
      const accessToken = signAccessToken({ sub: safeUser.id, email: safeUser.email, role: safeUser.role });
      const refreshToken = await issueRefreshToken(safeUser.id);

      return res.json({ accessToken, refreshToken, user: safeUser });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /auth/refresh ────────────────────────────────────────────────────────
router.post('/refresh', authRateLimiter, async (req, res, next) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'refreshToken required' } });
  }
  try {
    const result = await rotateRefreshToken(refreshToken);
    if (!result) {
      return res.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Token invalid or expired' } });
    }
    const { rows } = await query(
      `SELECT id, email, role FROM users WHERE id = $1`,
      [result.userId]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: { code: 'USER_NOT_FOUND' } });
    }
    const user = rows[0];
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    return res.json({ accessToken, refreshToken: result.newToken });
  } catch (err) {
    next(err);
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  try {
    if (refreshToken) await revokeRefreshToken(refreshToken);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
```

### A8 — Users route (GET /users/me)

Create `server/src/routes/users.ts`:

```typescript
import { Router } from 'express';
import { query } from '../db/client';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, email, name, role,
              location_zip AS "locationZip",
              location_lat AS "locationLat",
              location_lng AS "locationLng",
              licensed,
              created_at AS "createdAt"
       FROM users WHERE id = $1`,
      [req.user!.sub]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    return res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authenticate, async (req, res, next) => {
  const { name, locationZip } = req.body as { name?: string; locationZip?: string };
  try {
    const { rows } = await query(
      `UPDATE users
       SET name         = COALESCE($1, name),
           location_zip = COALESCE($2, location_zip)
       WHERE id = $3
       RETURNING id, email, name, role,
                 location_zip AS "locationZip", licensed,
                 created_at AS "createdAt"`,
      [name ?? null, locationZip ?? null, req.user!.sub]
    );
    return res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
```

### A9 — Wire up routes in index.ts

Replace the `auth` stub in `server/src/index.ts` with the real router and add the users route:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import listingsRouter from './routes/listings';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth',    authRouter);
app.use('/api/v1/users',   usersRouter);
app.use('/api/v1/listings', listingsRouter);

const stub = (_req: express.Request, res: express.Response) =>
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in a future milestone' } });

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

### A10 — Apply `authenticate` + `authorize` guards to listings write stubs

Update `server/src/routes/listings.ts` to gate write stubs by role (so M1 exit criterion passes):

```typescript
import { Router } from 'express';
import { query } from '../db/client';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT id, title, description, category,
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

// Write stubs — auth guard is live, logic comes in M2
router.post('/', authenticate, authorize('producer', 'broker', 'admin'),
  (_req, res) => res.status(501).json({ error: { code: 'NOT_IMPLEMENTED' } }));

router.get('/:id',
  (_req, res) => res.status(501).json({ error: { code: 'NOT_IMPLEMENTED' } }));

router.put('/:id', authenticate, authorize('producer', 'broker', 'admin'),
  (_req, res) => res.status(501).json({ error: { code: 'NOT_IMPLEMENTED' } }));

router.delete('/:id', authenticate, authorize('producer', 'broker', 'admin'),
  (_req, res) => res.status(501).json({ error: { code: 'NOT_IMPLEMENTED' } }));

router.patch('/:id/publish', authenticate, authorize('producer', 'broker', 'admin'),
  (_req, res) => res.status(501).json({ error: { code: 'NOT_IMPLEMENTED' } }));

export default router;
```

### A11 — Dev A exit smoke tests

```bash
npm run dev:server

# Register a new producer
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"producer@test.com","password":"password123","name":"Test Producer","role":"producer"}' \
  | python3 -m json.tool
# EXPECTED: { accessToken, refreshToken, user: { role: "producer", ... } }

# Save the accessToken and try a protected write endpoint
PRODUCER_TOKEN="<paste accessToken here>"

curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3000/api/v1/listings \
  -H "Authorization: Bearer $PRODUCER_TOKEN" \
  -H "Content-Type: application/json" -d '{}'
# EXPECTED: 501 (auth passes, stub returns not-implemented)

# Try the same with a consumer token (should 403)
CONSUMER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3000/api/v1/listings \
  -H "Authorization: Bearer $CONSUMER_TOKEN" \
  -H "Content-Type: application/json" -d '{}'
# EXPECTED: 403

# Try with no token
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3000/api/v1/listings \
  -H "Content-Type: application/json" -d '{}'
# EXPECTED: 401

# Refresh token flow
REFRESH=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['refreshToken'])")

curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | python3 -m json.tool
# EXPECTED: { accessToken, refreshToken } — new tokens issued, old refresh token gone
```

---

## Dev B Track — Frontend Auth (~4–5 hours)

### B1 — Install frontend dependencies

```bash
cd apps/web
npm install react-hook-form @hookform/resolvers zod
```

### B2 — Auth store

Create `apps/web/src/stores/authStore.ts`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../lib/api';
import type { User, AuthLoginRequest, AuthRegisterRequest } from '@community-garden/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (data: AuthLoginRequest) => Promise<void>;
  register: (data: AuthRegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string, user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setTokens: (accessToken, refreshToken, user) => {
        localStorage.setItem('accessToken', accessToken);
        set({ accessToken, refreshToken, user, isAuthenticated: true });
      },

      login: async (data) => {
        const res = await apiClient.post('/auth/login', data);
        get().setTokens(res.data.accessToken, res.data.refreshToken, res.data.user);
      },

      register: async (data) => {
        const res = await apiClient.post('/auth/register', data);
        get().setTokens(res.data.accessToken, res.data.refreshToken, res.data.user);
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          if (refreshToken) {
            await apiClient.post('/auth/logout', { refreshToken });
          }
        } finally {
          localStorage.removeItem('accessToken');
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialState: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

### B3 — Update API client with refresh interceptor

Replace `apps/web/src/lib/api.ts` with the version that handles token refresh automatically:

```typescript
import axios, { AxiosError } from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 — attempt one refresh, then redirect to login
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config) & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers!['Authorization'] = `Bearer ${token}`;
        return apiClient(original);
      });
    }
    original._retry = true;
    isRefreshing = true;
    const refreshToken = JSON.parse(localStorage.getItem('auth-storage') ?? '{}')?.state?.refreshToken;
    if (!refreshToken) {
      isRefreshing = false;
      window.location.href = '/login';
      return Promise.reject(error);
    }
    try {
      const { data } = await apiClient.post('/auth/refresh', { refreshToken });
      localStorage.setItem('accessToken', data.accessToken);
      // Update Zustand persisted store
      const stored = JSON.parse(localStorage.getItem('auth-storage') ?? '{}');
      if (stored?.state) {
        stored.state.accessToken = data.accessToken;
        stored.state.refreshToken = data.refreshToken;
        localStorage.setItem('auth-storage', JSON.stringify(stored));
      }
      processQueue(null, data.accessToken);
      original.headers!['Authorization'] = `Bearer ${data.accessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
```

### B4 — ProtectedRoute component

Create `apps/web/src/components/ProtectedRoute.tsx`:

```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { UserRole } from '@community-garden/types';

interface Props {
  children: React.ReactNode;
  roles?: UserRole[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}
```

### B5 — LoginPage

Create `apps/web/src/pages/LoginPage.tsx`:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch {
      setError('root', { message: 'Invalid email or password' });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-garden-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-md">
        <h1 className="text-2xl font-bold text-garden-700 mb-6">Sign in</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              {...register('email')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              {...register('password')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>
          {errors.root && (
            <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{errors.root.message}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-garden-600 hover:bg-garden-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          No account?{' '}
          <Link to="/register" className="text-garden-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### B6 — RegisterPage

Create `apps/web/src/pages/RegisterPage.tsx`:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name required'),
  role: z.enum(['consumer', 'producer', 'broker']),
  locationZip: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const register_ = useAuthStore((s) => s.register);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'consumer' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await register_(data);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Registration failed';
      setError('root', { message: msg });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-garden-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-md">
        <h1 className="text-2xl font-bold text-garden-700 mb-6">Create account</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              {...register('name')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              {...register('email')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              {...register('password')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">I am a</label>
            <select
              {...register('role')}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500 bg-white"
            >
              <option value="consumer">Consumer — buying local produce</option>
              <option value="producer">Producer — selling / growing</option>
              <option value="broker">Broker — connecting buyers and sellers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ZIP code <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              {...register('locationZip')}
              placeholder="e.g. 88001"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
          </div>
          {errors.root && (
            <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{errors.root.message}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-garden-600 hover:bg-garden-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-garden-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### B7 — Simple Dashboard placeholder

Create `apps/web/src/pages/DashboardPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-garden-50 flex flex-col items-center justify-center gap-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-garden-700">Welcome, {user?.name}</h1>
        <p className="text-gray-500 mt-1 capitalize">{user?.role}</p>
        <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
        <button
          onClick={handleLogout}
          className="mt-6 w-full bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 rounded-lg"
        >
          Sign out
        </button>
      </div>
      <p className="text-gray-400 text-sm">Listings and search coming in M2 / M3</p>
    </div>
  );
}
```

### B8 — Update App.tsx with real routes

Replace `apps/web/src/App.tsx` with real routing using `ProtectedRoute`:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import { ProtectedRoute } from './components/ProtectedRoute';

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
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected — any authenticated user */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute><PlaceholderPage name="AI Search (M3)" /></ProtectedRoute>
      } />
      <Route path="/browse" element={
        <ProtectedRoute><PlaceholderPage name="Browse Listings (M2)" /></ProtectedRoute>
      } />
      <Route path="/cart" element={
        <ProtectedRoute><PlaceholderPage name="Cart (M3)" /></ProtectedRoute>
      } />
      <Route path="/orders" element={
        <ProtectedRoute><PlaceholderPage name="Orders (M3)" /></ProtectedRoute>
      } />
      <Route path="/future" element={
        <ProtectedRoute><PlaceholderPage name="Future Orders (M4)" /></ProtectedRoute>
      } />

      {/* Producer-only (stub page for now — full content in M2) */}
      <Route path="/producer/dashboard" element={
        <ProtectedRoute roles={['producer', 'admin']}>
          <PlaceholderPage name="Producer Dashboard (M2)" />
        </ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="/unauthorized" element={
        <PlaceholderPage name="403 — Unauthorized" />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

### B9 — Dev B verification

```bash
npm run dev:web

# Open http://localhost:5173
# → Should redirect to /login (not authenticated)

# Register a consumer account via the UI form
# → Should land on / (AI Search placeholder page)

# Navigate to /producer/dashboard without a producer account
# → Should redirect to /unauthorized

# Open browser devtools → Application → Local Storage
# → auth-storage key should exist with user/token data

# Logout → should clear storage and redirect to /login
# → 0 console errors throughout
```

---

## Integration Verification (Both devs, ~30 min)

Run the full M1 exit criterion checklist together:

```bash
# ── Exit Criterion 1 ─────────────────────────────────────────────────────────
# Producer token → POST /listings returns 501 (stub, not 401)

PROD_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3000/api/v1/listings \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -H "Content-Type: application/json" -d '{}'
# EXPECTED: 501 ✓

# ── Exit Criterion 2 ─────────────────────────────────────────────────────────
# Consumer token → POST /listings returns 403

CONS_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3000/api/v1/listings \
  -H "Authorization: Bearer $CONS_TOKEN" \
  -H "Content-Type: application/json" -d '{}'
# EXPECTED: 403 ✓

# ── Exit Criterion 3 ─────────────────────────────────────────────────────────
# Refresh flow: valid refresh token → new tokens issued

LOGIN_RESP=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}')

REFRESH_TOKEN=$(echo $LOGIN_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['refreshToken'])")

REFRESH_RESP=$(curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
echo $REFRESH_RESP | python3 -m json.tool
# EXPECTED: { accessToken: "<new token>", refreshToken: "<new token>" } ✓

# Reusing the old refresh token should now fail (rotation)
curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" | python3 -m json.tool
# EXPECTED: 401 { code: "INVALID_REFRESH_TOKEN" } ✓

# ── Exit Criterion 4 ─────────────────────────────────────────────────────────
# Web: register → login → dashboard → logout — no console errors
# Perform manually in browser, check devtools for 0 errors ✓
```

---

## Tests to Write

Add to `server/src/__tests__/auth.test.ts`:

```typescript
// Minimum test coverage for M1 — expand in M5 if time permits

describe('POST /auth/register', () => {
  it('creates a user and returns tokens', ...)
  it('returns 409 on duplicate email', ...)
  it('returns 422 on invalid email format', ...)
  it('returns 422 on password shorter than 8 chars', ...)
  it('rejects role = admin', ...)   // admin can only be set by DB
})

describe('POST /auth/login', () => {
  it('returns tokens for valid credentials', ...)
  it('returns 401 for wrong password', ...)
  it('returns 401 for unknown email', ...)
})

describe('POST /auth/refresh', () => {
  it('issues new tokens and rotates refresh token', ...)
  it('returns 401 when refresh token is reused', ...)
  it('returns 401 for unknown token', ...)
})

describe('POST /auth/logout', () => {
  it('invalidates refresh token', ...)
  it('requires Authorization header', ...)
})

describe('Role guards', () => {
  it('producer token: POST /listings → 501 (not 401 or 403)', ...)
  it('consumer token: POST /listings → 403', ...)
  it('no token: POST /listings → 401', ...)
})
```

Run existing + new tests:

```bash
npm -w server run test
# EXPECTED: all green
```

---

## File Tree — M1 Complete State

```
server/src/
├── index.ts                         ← auth + users routes wired in; stubs for rest
├── config/
│   └── env.ts                       ← jwtAccessTtlSeconds, jwtRefreshTtlDays added
├── db/
│   ├── client.ts                    ← unchanged
│   ├── redis.ts                     ← NEW — ioredis singleton
│   ├── migrate.ts                   ← unchanged
│   ├── seed.ts                      ← unchanged
│   └── migrations/                  ← unchanged (no schema changes)
├── middleware/
│   ├── authenticate.ts              ← NEW — JWT verify, req.user
│   ├── authorize.ts                 ← NEW — role-guard factory
│   ├── rateLimiter.ts               ← NEW — Redis-backed 10 req/min on auth
│   └── errorHandler.ts             ← unchanged
├── routes/
│   ├── auth.ts                      ← NEW — register, login, refresh, logout
│   ├── users.ts                     ← NEW — GET /me, PATCH /me
│   └── listings.ts                  ← UPDATED — write stubs now auth-gated
├── services/
│   └── tokenService.ts              ← NEW — sign, issue, rotate, revoke, verify
└── __tests__/
    └── auth.test.ts                 ← NEW — register/login/refresh/role guard tests

apps/web/src/
├── App.tsx                          ← UPDATED — real routes + ProtectedRoute
├── lib/
│   └── api.ts                       ← UPDATED — refresh interceptor added
├── stores/
│   └── authStore.ts                 ← NEW — Zustand login/logout/register + persist
├── components/
│   └── ProtectedRoute.tsx           ← NEW — role-aware guard
└── pages/
    ├── LoginPage.tsx                ← NEW
    ├── RegisterPage.tsx             ← NEW
    └── DashboardPage.tsx            ← NEW — welcome + logout
```

---

## Common Issues & Fixes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `redis.getdel` not a function | ioredis version < 5 | Use `redis.get` + `redis.del` in two calls, or upgrade ioredis |
| `jwt.sign` type error: expiresIn expects `string` or `number` | Passing string where `number` expected | Use `expiresIn: env.jwtAccessTtlSeconds` (number, not string) |
| Rate limiter store `increment` signature mismatch | express-rate-limit v7 changed the store interface | Ensure the `RedisStore` class has both `increment` and `decrement` methods |
| Zustand `partialState` unknown property | API changed in Zustand v5 | Use `partialize` instead of `partialState` |
| `Cannot find module @community-garden/types` in server | Types not in server's node_modules | Run `npm install` from repo root (workspace hoisting) |
| `POST /auth/login` returns 404 in browser | Old `stub` handler still catching the route | Confirm `authRouter` is mounted before the `stub` fallback in `index.ts` |
| `ProtectedRoute` redirects even after login | `isAuthenticated` false after reload | Confirm `persist` middleware is wrapping the store and `accessToken` is in localStorage |

---

## Parallel Work Summary

| Dev | Focus | Hours |
|-----|-------|-------|
| Dev A | Redis client, tokenService, authenticate/authorize/rateLimiter middleware, auth routes, update index.ts + listings guards | ~5h |
| Dev B | authStore (Zustand), api.ts refresh interceptor, LoginPage, RegisterPage, DashboardPage, ProtectedRoute, update App.tsx | ~4–5h |

Dev A and Dev B can work fully in parallel from Phase 0 onward. The only sync point is the integration checklist at the end.

---

## Handoff to M2

When all exit criteria pass and tests are green, update `MILESTONES.md` M1 status to `✅ Done`.

M2 entry state guaranteed by M1:
- `authenticate` and `authorize` middleware are importable and tested
- Producer, consumer, and broker accounts obtainable via `POST /auth/login`
- Seed users' password is `password123` (Alice = producer, Bob = consumer)
- `req.user.sub` contains the UUID of the authenticated user — use it for `producer_id` in listings
- `GET /api/v1/listings` is still public (no auth required for browse)
