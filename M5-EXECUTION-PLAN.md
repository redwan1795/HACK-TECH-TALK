# M5 Execution Plan — Polish + Demo Hardening

**Milestone goal:** Add highest-value P1 features as working stubs, harden both demo scenarios for a zero-error live presentation.

**FR covered:** FR-05 (partial), FR-06 (stub), FR-07 (stub), FR-09, FR-10  
**Estimated effort:** 10–14 hours  
**Parallel split:** Dev A → backend (subscriptions, admin PATCH, error handler, demo seed) · Dev B → frontend (AdminConfigPage, SubscriptionModal, error boundaries, demo scripts)

---

## Entry Criteria

Before starting M5, verify:

- [ ] M4 exit criteria met (future orders + notifications fully working)
- [ ] Both demo scenarios rehearsed end-to-end at least once
- [ ] No open P0 bugs
- [ ] `subscriptions` table migration applied (`007_create_subscriptions.sql`)
- [ ] Stripe sandbox key configured (`STRIPE_SECRET_KEY=sk_test_...`)

---

## Current State

| Area | Status |
|------|--------|
| `POST /api/v1/subscriptions` | 501 stub in `index.ts` |
| `GET /api/v1/admin/config` | Working |
| `PATCH /api/v1/admin/config` | Missing |
| `AdminConfigPage` at `/admin` | Placeholder |
| `SubscriptionModal` / `ListingDetailPage` | Not created |
| `/exchange`, `/broker` routes | Not in `App.tsx` |
| Global Express error handler | `errorHandler` middleware exists — needs review |
| React error boundaries | Not implemented |
| `NotFoundPage` (404) | Falls through to `Navigate to="/"` |
| Loading skeletons | Partial — some pages missing |
| Demo seed data | Not created |
| Demo scripts | Not created |
| Offline AI response cache | Not in `cartStore` / Zustand |

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/src/routes/subscriptions.ts` | Real subscription routes replacing 501 stub |
| `apps/web/src/pages/AdminConfigPage.tsx` | Fee % form with live save |
| `apps/web/src/pages/ListingDetailPage.tsx` | Listing detail view + SubscriptionModal trigger |
| `apps/web/src/components/SubscriptionModal.tsx` | Cadence selector + Stripe subscription creation |
| `apps/web/src/pages/NotFoundPage.tsx` | 404 page |
| `apps/web/src/pages/BrokerDashboardPage.tsx` | "Coming soon" broker stub |
| `apps/web/src/components/ErrorBoundary.tsx` | React error boundary wrapper |
| `demo/seed-data.sql` | Deterministic demo accounts + listings |
| `demo/scenario1.md` | Step-by-step DS1 click path |
| `demo/scenario2.md` | Step-by-step DS2 click path |
| `server/src/__tests__/subscriptions.test.ts` | Integration + unit tests for subscriptions |
| `server/src/__tests__/adminConfig.test.ts` | Integration tests for PATCH /admin/config |
| `apps/web/src/__tests__/AdminConfigPage.test.tsx` | Frontend unit tests |
| `apps/web/src/__tests__/SubscriptionModal.test.tsx` | Frontend unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `server/src/routes/admin.ts` | Add `PATCH /config` endpoint with admin-only guard |
| `server/src/index.ts` | Wire real subscriptions router; replace stub |
| `apps/web/src/App.tsx` | Add `/admin`, `/listings/:id`, `/broker`, `/exchange`, `*` (NotFoundPage) routes |
| `apps/web/src/stores/cartStore.ts` | Add offline AI response cache to Zustand |
| `apps/web/src/pages/AISearchPage.tsx` | Save last response to store; show cached results when API fails |

---

## Step-by-Step Implementation

### Step 1 — PATCH /admin/config (Admin Fee Update)

**File:** `server/src/routes/admin.ts` — add to existing router

**Authorization:** Requires `authenticate` + `authorize('admin')`. Reject with 403 for any other role.

**Validation:**
- `fee_percent`: `isFloat({ min: 0, max: 100 })`, required

**Implementation:**

```typescript
import { authorize } from '../middleware/authorize';
import { body, validationResult } from 'express-validator';

router.patch(
  '/config',
  authenticate,
  authorize('admin'),
  body('fee_percent').isFloat({ min: 0, max: 100 }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const { fee_percent } = req.body as { fee_percent: number };
      await query(
        `INSERT INTO platform_config (key, value)
         VALUES ('fee_percent', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [fee_percent.toString()]
      );
      res.json({ fee_percent });
    } catch (err) {
      next(err);
    }
  }
);
```

**Note:** `platform_config` uses a key/value schema. The upsert pattern handles both first-time set and updates.

---

### Step 2 — Subscriptions Route

**File:** `server/src/routes/subscriptions.ts`

Three endpoints, all require `authenticate`. `POST /` and `GET /` require `consumer` role.

#### `POST /subscriptions` — Create subscription

**Validation:**
- `listing_id`: `isUUID`
- `cadence`: `isIn(['weekly', 'biweekly', 'monthly'])`
- `quantity`: `isFloat({ min: 0.01 })`

**Implementation:**
1. Verify listing exists and is available; 404 if not.
2. Fetch current `fee_percent` from `platform_config`.
3. Call `stripe.subscriptions.create()` in sandbox with a recurring price matching the listing's `price_cents` × `quantity`.
4. Insert into `subscriptions` table with `status: 'active'`, `stripe_subscription_id`, `cadence`, `listing_id`, `consumer_id`.
5. Return 201 with the inserted row.

**Error handling:** If Stripe throws, return 502 `STRIPE_ERROR` (do not expose raw Stripe error to client).

#### `GET /subscriptions` — List own subscriptions

```sql
SELECT s.*, l.title, l.price_cents
FROM subscriptions s
JOIN listings l ON l.id = s.listing_id
WHERE s.consumer_id = $1
ORDER BY s.created_at DESC
```

#### `DELETE /subscriptions/:id` — Cancel

1. Fetch row; 404 if not found.
2. 403 if `consumer_id !== req.user.sub`.
3. Call `stripe.subscriptions.cancel(row.stripe_subscription_id)`.
4. `UPDATE subscriptions SET status = 'cancelled' WHERE id = $1`.
5. Return 200.

---

### Step 3 — Wire Subscriptions in index.ts

**File:** `server/src/index.ts`

```typescript
// BEFORE (stub):
app.use('/api/v1/subscriptions', stub);

// AFTER:
import subscriptionsRouter from './routes/subscriptions';
app.use('/api/v1/subscriptions', subscriptionsRouter);
```

Keep `app.use('/api/v1/exchanges', stub)` — exchanges remain a 501 stub in M5.

---

### Step 4 — AdminConfigPage

**File:** `apps/web/src/pages/AdminConfigPage.tsx`  
**Route:** `/admin`  
**Access:** `ProtectedRoute roles={['admin']}`

**UI:**

```
Current platform fee: 7%

[Fee %: ____] [Save]

On save success: green toast "Fee updated to X%"
On error:        red inline error message
```

**Implementation:**
- On mount: `GET /api/v1/admin/config` via TanStack Query to populate the input.
- On submit: `PATCH /api/v1/admin/config` with `{ fee_percent }`.
- Invalidate the `['admin-config']` query key on success so `CartPage` fee estimate updates immediately.
- Input: `type="number"`, `min=0`, `max=100`, `step=0.1`.

---

### Step 5 — ListingDetailPage + SubscriptionModal

**File:** `apps/web/src/pages/ListingDetailPage.tsx`  
**Route:** `/listings/:id`

**UI:**
- Title, image, price, quantity available, distance, producer name.
- "Add to Cart" button (same as `ListingCard`).
- "Subscribe" button (consumer only) → opens `SubscriptionModal`.

**File:** `apps/web/src/components/SubscriptionModal.tsx`

**Props:** `{ listingId: string; listingTitle: string; pricePerUnit: number; onClose: () => void }`

**UI:**
```
Subscribe to: Navel Oranges
Cadence: [Weekly ▾]   (Weekly | Biweekly | Monthly)
Quantity: [1]
Estimated charge: $X.XX per delivery

[Confirm Subscription]   [Cancel]
```

**On confirm:** `POST /api/v1/subscriptions` with `{ listing_id, cadence, quantity }`.  
**Success state:** Show "Subscription created!" inside modal, then close after 1.5s.  
**Error state:** Show inline error; keep modal open.

---

### Step 6 — Error Resilience

#### 6a — React Error Boundary

**File:** `apps/web/src/components/ErrorBoundary.tsx`

```tsx
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <p className="text-lg text-red-600 font-semibold">Something went wrong.</p>
            <button
              className="mt-4 px-4 py-2 bg-garden-600 text-white rounded"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Wrap in App.tsx:**
```tsx
<Route path="/search" element={
  <ProtectedRoute>
    <ErrorBoundary><AISearchPage /></ErrorBoundary>
  </ProtectedRoute>
} />
<Route path="/checkout" element={
  <ProtectedRoute>
    <ErrorBoundary><CartCheckoutPage /></ErrorBoundary>
  </ProtectedRoute>
} />
```

#### 6b — NotFoundPage

**File:** `apps/web/src/pages/NotFoundPage.tsx`

```tsx
export default function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-garden-50">
      <div className="text-center p-8">
        <h1 className="text-6xl font-bold text-garden-700">404</h1>
        <p className="text-xl text-gray-500 mt-2">Page not found</p>
        <Link to="/" className="mt-6 inline-block px-6 py-2 bg-garden-600 text-white rounded">
          Go home
        </Link>
      </div>
    </div>
  );
}
```

**In App.tsx** — replace the catch-all `Navigate` with:
```tsx
<Route path="*" element={<NotFoundPage />} />
```

#### 6c — Verify Express Error Handler

**File:** `server/src/middleware/errorHandler.ts` — confirm it follows the standard `{ error: { code, message } }` shape. If not, update to:

```typescript
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[errorHandler]', err);
  const status = (err as { status?: number }).status ?? 500;
  const code   = (err as { code?: string }).code ?? 'INTERNAL_ERROR';
  const message = err instanceof Error ? err.message : 'An unexpected error occurred';
  res.status(status).json({ error: { code, message } });
}
```

---

### Step 7 — Stub Pages (Broker + Exchange)

**File:** `apps/web/src/pages/BrokerDashboardPage.tsx`

```tsx
export default function BrokerDashboardPage() {
  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold text-garden-700">Broker Dashboard</h1>
      <p className="text-gray-500 mt-2">Multi-producer order coordination coming soon.</p>
    </div>
  );
}
```

**In App.tsx:**
```tsx
<Route path="/broker" element={
  <ProtectedRoute roles={['broker']}>
    <BrokerDashboardPage />
  </ProtectedRoute>
} />
<Route path="/exchange" element={
  <ProtectedRoute>
    <div className="max-w-2xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold text-garden-700">Exchange</h1>
      <p className="text-gray-500 mt-2">Produce exchange marketplace coming soon.</p>
    </div>
  </ProtectedRoute>
} />
```

---

### Step 8 — Offline AI Search Cache

**File:** `apps/web/src/stores/cartStore.ts` — add to Zustand store

```typescript
// Add to store state:
lastAISearchResults: AISearchResponse | null;
lastAISearchQuery: string | null;

// Add actions:
setLastAISearch: (query: string, results: AISearchResponse) => void;
```

**File:** `apps/web/src/pages/AISearchPage.tsx` — on successful API response:
```typescript
setLastAISearch(query, data);
```

On API error, if `lastAISearchResults !== null`:
```tsx
<div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
  Showing cached results from your last search — "{lastAISearchQuery}"
</div>
{/* Render lastAISearchResults.results */}
```

---

### Step 9 — App.tsx Route Updates

Add all new routes to [apps/web/src/App.tsx](apps/web/src/App.tsx):

```tsx
import AdminConfigPage from './pages/AdminConfigPage';
import ListingDetailPage from './pages/ListingDetailPage';
import BrokerDashboardPage from './pages/BrokerDashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import { ErrorBoundary } from './components/ErrorBoundary';

// Replace /admin placeholder:
<Route path="/admin" element={
  <ProtectedRoute roles={['admin']}>
    <AdminConfigPage />
  </ProtectedRoute>
} />

// Add listing detail:
<Route path="/listings/:id" element={
  <ProtectedRoute><ListingDetailPage /></ProtectedRoute>
} />

// Add broker + exchange:
<Route path="/broker" element={
  <ProtectedRoute roles={['broker']}>
    <BrokerDashboardPage />
  </ProtectedRoute>
} />
<Route path="/exchange" element={
  <ProtectedRoute>
    <div className="max-w-2xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold text-garden-700">Exchange</h1>
      <p className="text-gray-500 mt-2">Coming soon.</p>
    </div>
  </ProtectedRoute>
} />

// Replace Navigate catch-all:
<Route path="*" element={<NotFoundPage />} />

// Wrap AI search + checkout in ErrorBoundary (as shown in Step 6a)
```

---

### Step 10 — Demo Seed Data

**File:** `demo/seed-data.sql`

```sql
-- Truncate and re-seed deterministic demo data
TRUNCATE users, listings, orders, order_items, future_orders, subscriptions
  CASCADE;

-- Demo accounts (bcrypt of 'password123')
INSERT INTO users (id, email, password_hash, name, role) VALUES
  ('11111111-0000-0000-0000-000000000001', 'demo-consumer@test.com',
   '$2b$10$...', 'Alex Consumer', 'consumer'),
  ('22222222-0000-0000-0000-000000000002', 'demo-producer@test.com',
   '$2b$10$...', 'Sam Producer', 'producer'),
  ('33333333-0000-0000-0000-000000000003', 'demo-admin@test.com',
   '$2b$10$...', 'Admin User', 'admin');

-- Listings for DS1 (Scenario 1: zucchini search)
INSERT INTO listings (id, producer_id, title, description, category,
  price_cents, quantity_available, unit, location_zip,
  location_lat, location_lng, is_available) VALUES
  ('aaaa0001-...', '22222222-0000-0000-0000-000000000002',
   'Fresh Zucchini', 'Locally grown, harvested this morning',
   'vegetable', 300, 20, 'lb', '88001', 32.3099, -106.7737, true),
  ('aaaa0002-...', '22222222-0000-0000-0000-000000000002',
   'Heirloom Tomatoes', 'Mixed variety from greenhouse',
   'vegetable', 400, 15, 'lb', '88001', 32.3099, -106.7737, true),
  ('aaaa0003-...', '22222222-0000-0000-0000-000000000002',
   'Sweet Corn', '6-pack, picked daily',
   'vegetable', 500, 30, 'bunch', '88005', 32.3500, -106.8000, true);

-- platform_config
INSERT INTO platform_config (key, value) VALUES ('fee_percent', '7')
  ON CONFLICT (key) DO UPDATE SET value = '7';
```

**Usage:** `psql $DATABASE_URL < demo/seed-data.sql`

**Note:** Replace `$2b$10$...` placeholders with actual bcrypt hash of `password123` generated during implementation (`bcrypt.hashSync('password123', 10)`). Exact UUIDs should be stable — hardcode them so `matched_listing_id` references work across runs.

---

### Step 11 — Demo Scripts

**File:** `demo/scenario1.md`

```markdown
# Demo Scenario 1 — AI Search → Checkout

**Target time:** < 90 seconds  
**Accounts:** consumer: demo-consumer@test.com / password123

1. Open http://localhost:5173/ — show landing page (5s)
2. Click "Sign In" → log in as demo-consumer@test.com (10s)
3. Navigate to /search — show AI search bar (5s)
4. Type: "Find me some zucchini" → press Enter (5s)
5. Loading skeleton → results appear with explanation text (8s)
6. Click "Add to Cart" on "Fresh Zucchini" (3s)
7. Navigate to /cart — show line item + 7% fee estimate (5s)
8. Click "Proceed to Checkout" (3s)
9. Stripe card: 4242 4242 4242 4242 / 12/34 / 123 / ZIP 88001 (15s)
10. Click "Pay" → wait for confirmation (10s)
11. Order confirmation: point to subtotal, fee, total line items (10s)

**Total: ~79 seconds**

## Contingency
- If AI search fails: navigate to /browse?q=zucchini (keyword fallback visible)
- If Stripe fails: show pre-recorded screen recording (stored in demo/recordings/)
```

**File:** `demo/scenario2.md`

```markdown
# Demo Scenario 2 — Future Order → Notification

**Target time:** < 60 seconds  
**Accounts:** consumer: demo-consumer@test.com / producer: demo-producer@test.com

1. Log in as demo-consumer@test.com (8s)
2. Navigate to /future-orders/new (3s)
3. Type: "I need 10 oranges within the next 2 days" → click "Parse my request" (8s)
4. Confirmation card appears: product "oranges", qty 10, expiry ~48h (5s)
5. Click "Confirm & Save" → success state (5s)
6. Open new tab → log in as demo-producer@test.com (10s)
7. Navigate to /listings/new → create "Navel Oranges, $2/lb, ZIP 88001, category: fruit" (8s)
8. Click "Publish" on the listing (3s)
9. Switch to mailtrap.io tab → email arrives within 5 seconds (5s)
10. Show email subject + listing link (5s)

**Total: ~60 seconds**

## Contingency
- If email delayed: show DB record in psql: `SELECT status, matched_listing_id FROM future_orders;`
- Pre-warm: ensure demo-consumer has an existing open future_order in seed data
```

---

## Test Cases (from TEST-PLAN.md §8)

### Unit Tests — Subscriptions

**File:** `server/src/__tests__/subscriptions.test.ts`

| ID | Test | Setup | Assertion |
|----|------|-------|-----------|
| M5-U-01 | `SubscriptionModal` renders cadence options | Render component | "Weekly", "Biweekly", "Monthly" all in DOM |

**Frontend file:** `apps/web/src/__tests__/SubscriptionModal.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { SubscriptionModal } from '../components/SubscriptionModal';

test('M5-U-01: renders all cadence options', () => {
  render(
    <SubscriptionModal
      listingId="abc"
      listingTitle="Navel Oranges"
      pricePerUnit={200}
      onClose={() => {}}
    />
  );
  expect(screen.getByRole('option', { name: 'Weekly' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Biweekly' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Monthly' })).toBeInTheDocument();
});
```

---

### Integration Tests — Subscriptions

**File:** `server/src/__tests__/subscriptions.test.ts`

Mock Stripe with `jest.mock('stripe')`:

```typescript
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    subscriptions: {
      create: jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'active' }),
      cancel: jest.fn().mockResolvedValue({ id: 'sub_test123', status: 'canceled' }),
    },
  }))
);
```

| ID | Test | HTTP Call | Expected Response |
|----|------|-----------|-------------------|
| M5-I-01 | Create subscription with `status: 'active'` | `POST /api/v1/subscriptions` with consumer JWT + `{ listing_id, cadence: 'weekly', quantity: 1 }` | 201; DB record has `status: 'active'`, `stripe_subscription_id: 'sub_test123'` |
| M5-I-02 | Producer cannot subscribe | `POST /api/v1/subscriptions` with producer JWT | 403 |
| M5-I-03 | Invalid cadence returns 400 | `POST /api/v1/subscriptions` with `cadence: 'daily'` | 400 |
| M5-I-04 | GET returns only authenticated consumer's subscriptions | Consumer A + Consumer B each have a subscription; GET as Consumer A | Consumer B's subscription absent |

**Test structure for M5-I-01:**

```typescript
it('M5-I-01: creates subscription and returns 201', async () => {
  const { user: consumer, token } = await createConsumerUser();
  const { user: producer }        = await createProducerUser();
  const listing = await createListing({
    producer_id: producer.id,
    price_cents: 300,
    is_available: true,
  });

  const res = await request(app)
    .post('/api/v1/subscriptions')
    .set('Authorization', `Bearer ${token}`)
    .send({ listing_id: listing.id, cadence: 'weekly', quantity: 2 });

  expect(res.status).toBe(201);
  expect(res.body.status).toBe('active');
  expect(res.body.stripe_subscription_id).toBe('sub_test123');

  // Verify DB row
  const { rows } = await query(
    'SELECT * FROM subscriptions WHERE consumer_id = $1', [consumer.id]
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].cadence).toBe('weekly');
});
```

---

### Integration Tests — Admin Config

**File:** `server/src/__tests__/adminConfig.test.ts`

| ID | Test | HTTP Call | Expected Response |
|----|------|-----------|-------------------|
| M5-I-05 | GET returns current `fee_percent` | `GET /api/v1/admin/config` with any auth JWT | 200; `{ fee_percent: 7 }` |
| M5-I-06 | PATCH updates fee; next order uses new rate | `PATCH /api/v1/admin/config` with admin JWT, `{ fee_percent: 10 }` → then create order | Order's `platform_fee_cents = floor(subtotal * 0.10)` |
| M5-I-07 | Consumer cannot PATCH admin config | `PATCH /api/v1/admin/config` with consumer JWT | 403 |
| M5-I-08 | `fee_percent > 100` returns 400 | `PATCH /api/v1/admin/config` with `{ fee_percent: 101 }` | 400 |
| M5-I-09 | `fee_percent < 0` returns 400 | `PATCH /api/v1/admin/config` with `{ fee_percent: -1 }` | 400 |

**Test structure for M5-I-06 (most important):**

```typescript
it('M5-I-06: PATCH fee_percent → subsequent order uses new rate', async () => {
  const { token: adminToken } = await createAdminUser();
  const { token: consumerToken } = await createConsumerUser();
  const { user: producer } = await createProducerUser();
  const listing = await createListing({ producer_id: producer.id, price_cents: 1000 });

  // Update fee to 10%
  await request(app)
    .patch('/api/v1/admin/config')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ fee_percent: 10 })
    .expect(200);

  // Create order
  const orderRes = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${consumerToken}`)
    .send({ items: [{ listing_id: listing.id, quantity: 1 }] });

  expect(orderRes.status).toBe(201);
  // 1000 cents × 10% = floor(100) = 100
  expect(orderRes.body.platform_fee_cents).toBe(100);
});
```

---

### Integration Tests — Broker Multi-Producer Order

**File:** `server/src/__tests__/orders.test.ts` — add to existing file

| ID | Test | HTTP Call | Expected Response |
|----|------|-----------|-------------------|
| M5-I-10 | Order with items from 3 producers creates 3 `order_items` | `POST /orders` with consumer JWT, items from 3 different producer listings | 201; `order_items.length === 3` |
| M5-I-11 | Platform fee calculated on combined subtotal | Same as above (3 items, total subtotal $30) | `platform_fee_cents = floor(3000 * 0.07) = 210`; single fee on order |

---

### Frontend Tests — AdminConfigPage

**File:** `apps/web/src/__tests__/AdminConfigPage.test.tsx`

| ID | Test | Setup | Assertion |
|----|------|-------|-----------|
| M5-F-01 | Fee form submits correct value and shows success toast | Mock `GET /admin/config` → 7; render page; change input to 10; click "Save" | `PATCH /admin/config` mock called with `{ fee_percent: 10 }`; success toast visible |

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '../test/server'; // msw server
import { http, HttpResponse } from 'msw';
import AdminConfigPage from '../pages/AdminConfigPage';

test('M5-F-01: fee form submits and shows success', async () => {
  server.use(
    http.get('/api/v1/admin/config', () => HttpResponse.json({ fee_percent: 7 })),
    http.patch('/api/v1/admin/config', () => HttpResponse.json({ fee_percent: 10 })),
  );

  render(<AdminConfigPage />);
  const input = await screen.findByRole('spinbutton'); // number input
  fireEvent.change(input, { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(screen.getByText(/fee updated to 10%/i)).toBeInTheDocument();
  });
});
```

---

### Demo Scenario Acceptance Tests

These run manually before the hackathon presentation.

#### DS1 — AI Search → Checkout

| Step | Action | Target Time | Pass |
|------|--------|-------------|------|
| DS1-01 | Load `/` as unauthenticated | < 2s | [ ] |
| DS1-02 | Log in as demo-consumer | < 5s | [ ] |
| DS1-03 | Type "Find me some zucchini", press Enter | < 1s | [ ] |
| DS1-04 | Results appear with explanation | < 5s from Enter | [ ] |
| DS1-05 | Add to cart; navigate to `/cart` | < 3s | [ ] |
| DS1-06 | Proceed to checkout; Stripe renders | < 3s | [ ] |
| DS1-07 | Enter card 4242..., pay | < 10s | [ ] |
| DS1-08 | Order confirmation shows fee breakdown | < 3s | [ ] |
| DS1-09 | DB: `status = 'paid'`, `quantity_available` decremented | — | [ ] |
| **TOTAL** | | **< 90s** | [ ] |

**Console errors allowed:** 0  
**Network errors allowed:** 0  

#### DS2 — Future Order → Notification

| Step | Action | Target Time | Pass |
|------|--------|-------------|------|
| DS2-01 | Log in as demo-consumer | < 5s | [ ] |
| DS2-02 | Navigate to `/future-orders/new` | < 2s | [ ] |
| DS2-03 | Submit "I need 10 oranges within the next 2 days" | < 1s | [ ] |
| DS2-04 | Parsed intent card visible | < 5s from submit | [ ] |
| DS2-05 | Click "Confirm & Save"; success state | < 3s | [ ] |
| DS2-06 | Switch tab; log in as demo-producer | < 8s | [ ] |
| DS2-07 | Create + publish "Navel Oranges" listing | < 15s | [ ] |
| DS2-08 | Email arrives in mailtrap inbox | < 10s from publish | [ ] |
| DS2-09 | DB: `status = 'matched'`, `matched_listing_id` set | — | [ ] |
| **TOTAL** | | **< 60s** | [ ] |

---

## Loading Skeletons Audit

Verify all data-fetching pages have a loading skeleton (no blank flash):

| Page | Has Skeleton? | Action if Missing |
|------|--------------|-------------------|
| `AISearchPage` | Yes | — |
| `ListingsPage` | Verify | Add `<SkeletonCard />` grid if missing |
| `ProducerDashboard` | Verify | Add skeleton rows |
| `FutureOrdersListPage` | Verify | Add skeleton rows |
| `CartPage` | Verify | Add skeleton |
| `AdminConfigPage` | To create | Add skeleton while fetching current fee |
| `ListingDetailPage` | To create | Add skeleton |

---

## Environment Variables (M5 additions)

Add to `.env` and `.env.example`:

```
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

No new server env vars required (Stripe keys were already specified from M0).

---

## Exit Criteria

| Check | Pass Criteria |
|-------|--------------|
| DS1-EX-01 | Demo Scenario 1 completes end-to-end in < 90 seconds, zero console errors |
| DS1-EX-02 | Demo Scenario 2 completes end-to-end in < 60 seconds, email in mailtrap inbox |
| DS1-EX-03 | Admin changes fee % → immediately reflected in next order's fee |
| DS1-EX-04 | All protected routes return 401 (no token) or 403 (wrong role) consistently |
| DS1-EX-05 | `NotFoundPage` renders for any unknown route |
| DS1-EX-06 | Error boundary catches thrown component errors without crashing the app |
| DS1-EX-07 | `demo/seed-data.sql` loads cleanly from scratch and supports both demo runs |
| DS1-EX-08 | All M5 tests pass (`npm test` exits 0) |

---

## Implementation Order

```
Hour 1–2  (Dev A)  Steps 1–3:  PATCH /admin/config + subscriptions route + wire index.ts
Hour 1–2  (Dev B)  Steps 4–5:  AdminConfigPage + ListingDetailPage skeleton
Hour 3    (Dev A)  Step 10:    demo/seed-data.sql (generate bcrypt hashes, stable UUIDs)
Hour 3    (Dev B)  Step 5:     SubscriptionModal component + unit test
Hour 4    (Dev A)  Tests:      adminConfig.test.ts + subscriptions.test.ts
Hour 4    (Dev B)  Steps 6–7:  ErrorBoundary, NotFoundPage, BrokerDashboardPage, App.tsx updates
Hour 5    (Dev A)  Step 10+11: Finalize seed + demo scripts
Hour 5    (Dev B)  Steps 8–9:  Offline AI cache in cartStore + AISearchPage fallback
Hour 6    (Dev A)  Tests:      M5-I-10, M5-I-11 (broker multi-producer order tests)
Hour 6    (Dev B)  Frontend tests: AdminConfigPage.test.tsx + SubscriptionModal.test.tsx
Hour 7–8  (Both)  Demo Scenario 1 + 2 full rehearsal, bug fixes, loading skeleton audit
Hour 9    (Both)  Record backup videos of both scenarios; prep contingency notes
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Stripe subscription API has a test-mode peculiarity | Use `stripe.subscriptions.create` with a one-off `price_data` object so no pre-created product/price ID is needed in sandbox |
| `platform_config` upsert race condition under load | `ON CONFLICT (key) DO UPDATE` is atomic in PostgreSQL — safe |
| Demo seed bcrypt generation is slow at high cost factor | Use cost factor 10 (default) and pre-compute hashes offline; hardcode in SQL |
| Loading skeleton missing causes layout shift in demo | Audit all pages in Step 8 before rehearsal; use `Suspense` fallback where possible |
| Offline AI cache shows stale results to a live judge | Show a clear "Cached results" banner (yellow) so it's transparent, not deceptive |
| Error boundary catches expected errors (API 401) | Only wrap genuinely unpredictable surfaces (AI search render, checkout Stripe element) |
```
