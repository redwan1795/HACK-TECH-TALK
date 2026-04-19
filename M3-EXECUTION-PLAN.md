# M3 Execution Plan — AI Search + Stripe Checkout + Platform Fee

## Overview
Three integrated features that complete Demo Scenario 1:
1. **AI natural-language search** — Claude `tool_use` extracts intent from plain text and returns ranked listings with an explanation string.
2. **Cart + Stripe checkout** — Consumer adds listing to cart, PaymentElement charges via Stripe sandbox, stock decrements on confirm.
3. **Order confirmation with platform fee** — Server-computed fee shown as a separate line item.

## Entry Criteria
- M2 + M2-A fully working: listings CRUD, delivery/pickup fields, ZIP/radius search, landing page
- Migrations 001–003 applied
- ≥5 seeded listings with varied categories and ZIPs
- `ANTHROPIC_API_KEY` set in `.env`
- `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` set in `.env` (sandbox keys)
- `platform_config` row exists with `fee_percent = 7`

---

## Phase A — DB & Shared Types (~25 min)

### A1 — Migration 004: Orders Tables
**File:** `server/src/db/migrations/004_create_orders.sql`

```sql
CREATE TABLE orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id  UUID NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','paid','cancelled')),
  subtotal     NUMERIC(10,2) NOT NULL,
  fee_percent  NUMERIC(5,2) NOT NULL,
  fee_amount   NUMERIC(10,2) NOT NULL,
  total        NUMERIC(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES listings(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(10,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_consumer_id ON orders(consumer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
```

Apply: `psql $DATABASE_URL -f server/src/db/migrations/004_create_orders.sql`

### A2 — Shared Types Update
**File:** `packages/shared-types/src/index.ts`

Add/update:
```ts
export interface AISearchRequest {
  query: string;
  user_zip?: string;
}

export interface AISearchResponse {
  intent: string;          // human-readable extraction summary
  results: Listing[];
  explanation: string;     // Claude's prose explanation of the results
}

export interface CartItem {
  listing: Listing;
  quantity: number;
}

export interface Order {
  id: string;
  consumerId: string;
  status: 'pending' | 'paid' | 'cancelled';
  subtotal: number;
  feePercent: number;
  feeAmount: number;
  total: number;
  stripePaymentIntentId?: string;
  items: OrderItem[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  listingId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderRequest {
  items: { listingId: string; quantity: number }[];
}
```

---

## Phase B — Backend (~3.5 hours)

### B1 — Claude System Prompt
**File:** `server/src/prompts/searchSystem.txt`

```
You are a produce search assistant for a community garden marketplace.
Extract the user's search intent and call the search_listings tool.
Always call the tool — never return a plain text answer.
Normalize relative quantities and vague location references using the user's ZIP when provided.
```

**File:** `server/src/prompts/searchTool.json` — tool schema:
```json
{
  "name": "search_listings",
  "description": "Search produce listings by keyword, location, and filters",
  "input_schema": {
    "type": "object",
    "properties": {
      "keyword":      { "type": "string" },
      "category":     { "type": "string" },
      "zip":          { "type": "string" },
      "radius_miles": { "type": "number", "default": 25 },
      "max_price":    { "type": "number" }
    },
    "required": ["keyword"]
  }
}
```

### B2 — aiSearchService.ts
**File:** `server/src/services/aiSearchService.ts`

Flow:
1. Send user query + system prompt to Claude with `search_listings` tool forced (`tool_choice: { type: "tool", name: "search_listings" }`).
2. Extract tool input `{ keyword, category, zip, radius_miles, max_price }`.
3. Call `listingService.search()` with extracted params.
4. Return `{ intent: JSON.stringify(toolInput), results, explanation: "Found N listings matching ..." }`.
5. On any Claude error: fall back to `listingService.search({ keyword: rawQuery })` and set `intent = 'fallback'`.

Key details:
- Use `@anthropic-ai/sdk` `messages.create()`.
- Model: `claude-haiku-4-5-20251001` (low latency for search).
- `max_tokens: 1024` — tool input only, no long generation needed.
- Wrap in try/catch; log error; return fallback result set, never throw to route.

### B3 — POST /api/v1/ai/search
**File:** `server/src/routes/ai.ts` (new)

```
POST /api/v1/ai/search
  Auth: required (any role)
  Rate limit: 20 req/user/hour (Redis key: ai_search:{userId})
  Body: { query: string, user_zip?: string }
  Validation:
    body('query').trim().isLength({ min: 2, max: 500 })
    body('user_zip').optional().matches(/^\d{5}$/)
  Response 200: AISearchResponse
  Response 422: VALIDATION_ERROR
  Response 429: RATE_LIMIT_EXCEEDED
```

Wire into `server/src/index.ts`: `app.use('/api/v1/ai', aiRouter)`.

### B4 — orders.ts Route
**File:** `server/src/routes/orders.ts` (new)

#### POST /api/v1/orders
Auth: consumer role required.

Steps:
1. Validate `items[]` — each `{ listingId, quantity }` non-empty integer.
2. Fetch each listing from DB; confirm `status = 'active'` and `quantity_available >= requested`.
3. Compute `subtotal = sum(unitPrice * qty)`.
4. Fetch `fee_percent` from `platform_config`.
5. Compute `fee_amount = round(subtotal * fee_percent / 100, 2)`, `total = subtotal + fee_amount`.
6. Create Stripe `PaymentIntent` with `amount = total * 100` (cents), `currency = 'usd'`, `metadata: { orderId }`.
7. Insert `orders` row (`status: 'pending'`, `stripe_payment_intent_id`).
8. Insert `order_items` rows.
9. Return `{ order, clientSecret }` — client secret is passed to `PaymentElement`.

**Critical:** Fee is always computed server-side. Never accept fee values from the client body.

#### POST /api/v1/orders/:id/confirm
Auth: consumer (must own the order).

Steps:
1. Verify `stripe_payment_intent_id` status via `stripe.paymentIntents.retrieve()`.
2. If `status === 'succeeded'`: update order `status → 'paid'`; decrement each listing's `quantity_available` in a transaction.
3. Return updated order.
4. If status is not `succeeded`: return 402 `PAYMENT_NOT_CONFIRMED`.

#### GET /api/v1/orders
Auth: consumer (own orders) or admin (all).
Returns orders with joined `order_items`.

### B5 — Admin Config GET
**File:** `server/src/routes/admin.ts` — add:
```
GET /api/v1/admin/config
  Auth: any authenticated role (read-only)
  Response: { fee_percent: number }
```
Reads from `platform_config` table (single row).

---

## Phase C — Frontend (~3.5 hours)

### C1 — AISearchPage.tsx
**File:** `apps/web/src/pages/AISearchPage.tsx`
Route: `/search` (authenticated). Update `App.tsx` to add this route under `ProtectedRoute`.

Layout:
```
[Large textarea placeholder="What are you looking for? e.g. 'fresh zucchini near me'"]
[Search button]
--- on results ---
[AI explanation string in a subtle callout box]
[ListingCard grid — same component as M2]
[Fallback link: "Try standard search →" shown when intent === 'fallback']
```

State:
- `query: string` — controlled textarea
- `isLoading: boolean` — show skeleton grid (6 placeholder cards) while fetching
- `result: AISearchResponse | null`
- `error: string | null` — show inline error + fallback link

On submit: `POST /api/v1/ai/search` via TanStack Query mutation.
Each `ListingCard` gets an "Add to Cart" button that calls `cartStore.addItem()`.

### C2 — cartStore.ts
**File:** `apps/web/src/stores/cartStore.ts`

```ts
interface CartStore {
  items: CartItem[];          // CartItem = { listing, quantity }
  addItem: (listing: Listing, quantity?: number) => void;
  removeItem: (listingId: string) => void;
  updateQuantity: (listingId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: () => number;
}
```

- Zustand `create` with `persist` middleware to `localStorage` key `cart`.
- `addItem`: if listing already in cart, increment quantity (cap at `listing.quantityAvailable`).
- `subtotal()`: `items.reduce((sum, i) => sum + i.listing.price * i.quantity, 0)`.

### C3 — CartPage.tsx
**File:** `apps/web/src/pages/CartPage.tsx`
Route: `/cart` (authenticated).

Layout:
```
[Item list — thumbnail, title, price × qty, remove button, quantity stepper]
[Divider]
[Subtotal row]
[Platform fee row — fetched from GET /admin/config, shown as "Service fee (7%)"]
[Total row]
[Proceed to Checkout button → /checkout]
[Empty state: "Your cart is empty" + link to /search]
```

Fetch `fee_percent` via TanStack Query on mount; derive `feeAmount` and `total` client-side for display only (server recomputes authoritatively on order creation).

### C4 — CheckoutPage.tsx (upgrade from M2-A stub)
**File:** `apps/web/src/pages/CheckoutPage.tsx`
Route: `/checkout` (authenticated, consumer role).

This replaces the M2-A stub. Full Stripe `PaymentElement` integration:

1. On mount: call `POST /api/v1/orders` with cart items → receive `{ order, clientSecret }`.
2. Initialize Stripe with `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)`.
3. Wrap in `<Elements stripe={stripe} options={{ clientSecret }}>`.
4. Render `<PaymentElement />` inside a form.
5. On form submit: call `stripe.confirmPayment({ redirect: 'if_required' })`.
6. On success: call `POST /api/v1/orders/:id/confirm` → navigate to `/orders/:id/confirmation`.
7. On Stripe error: show inline error message, keep form open.

Loading states: skeleton while `POST /orders` is in flight. Error boundary if order creation fails (e.g., insufficient stock — show per-item error).

Install: `npm install @stripe/react-stripe-js @stripe/stripe-js` in `apps/web`.

### C5 — OrderConfirmationPage.tsx
**File:** `apps/web/src/pages/OrderConfirmationPage.tsx`
Route: `/orders/:id/confirmation` (authenticated).

Fetch `GET /api/v1/orders/:id` on mount and display:
```
✓ Order Confirmed
────────────────────────────────
[Item rows — name × qty    $X.XX]
────────────────────────────────
Subtotal                   $X.XX
Service fee (7%)           $X.XX
────────────────────────────────
Total                      $X.XX
────────────────────────────────
[Continue Shopping button → /search]
```

Show skeleton while fetching. If order not found or consumer mismatch → redirect to `/`.

### C6 — App.tsx Updates
Add routes:
```tsx
/search          → <ProtectedRoute><AISearchPage /></ProtectedRoute>
/cart            → <ProtectedRoute><CartPage /></ProtectedRoute>
/checkout        → <ProtectedRoute roles={['consumer']}><CheckoutPage /></ProtectedRoute>
/orders/:id/confirmation → <ProtectedRoute><OrderConfirmationPage /></ProtectedRoute>
```

Update `LandingPage` CTAs and navbar: add "Search" link (visible when logged in) pointing to `/search`.
Add cart icon with item count badge in navbar (reads from `cartStore`).

---

## Test Plan

### Backend Tests

#### `server/src/__tests__/aiSearch.test.ts` (new)

| Test | Assertion |
|------|-----------|
| `aiSearchService` — Claude returns tool call | `results` array returned, `intent` JSON matches extracted params |
| `aiSearchService` — Claude API throws | Falls back to keyword search, `intent === 'fallback'`, no thrown error |
| `POST /ai/search` — valid query | 200, body has `intent`, `results[]`, `explanation` |
| `POST /ai/search` — query too short (<2 chars) | 422 VALIDATION_ERROR |
| `POST /ai/search` — unauthenticated | 401 |
| `POST /ai/search` — rate limit exceeded (21st req) | 429 RATE_LIMIT_EXCEEDED |
| `POST /ai/search` — invalid zip format | 422 VALIDATION_ERROR |

Mock strategy: `jest.mock('@anthropic-ai/sdk')` — return a fixture `tool_use` block for happy path; `throw new Error('timeout')` for fallback path.

#### `server/src/__tests__/orders.test.ts` (new)

| Test | Assertion |
|------|-----------|
| `POST /orders` — valid items, consumer auth | 201, order created, `clientSecret` present, fee computed server-side |
| `POST /orders` — listing quantity insufficient | 409 INSUFFICIENT_STOCK with per-item detail |
| `POST /orders` — listing not active (draft) | 409 LISTING_NOT_AVAILABLE |
| `POST /orders` — producer auth (wrong role) | 403 |
| `POST /orders` — unauthenticated | 401 |
| `POST /orders` — empty items array | 422 VALIDATION_ERROR |
| `POST /orders/:id/confirm` — PI status succeeded | 200, order `status = 'paid'`, listing quantity decremented |
| `POST /orders/:id/confirm` — PI status requires_action | 402 PAYMENT_NOT_CONFIRMED |
| `POST /orders/:id/confirm` — wrong consumer | 403 |
| `GET /orders` — consumer sees own orders only | 200, array filtered to requesting user |
| Fee computation | `subtotal=3.00, fee_percent=7` → `fee_amount=0.21`, `total=3.21` |

Mock strategy: `jest.mock('stripe')` — `paymentIntents.create()` returns fixture with `client_secret`; `paymentIntents.retrieve()` returns `{ status: 'succeeded' }` or `{ status: 'requires_action' }`.

#### `server/src/__tests__/listings.test.ts` (extend existing)

| Test | Assertion |
|------|-----------|
| After confirmed order, `quantity_available` decremented | `GET /listings/:id` returns reduced quantity |
| Concurrent confirm calls don't double-decrement | Use DB transaction; second confirm returns 402 |

---

### Frontend Tests

#### `apps/web/src/__tests__/AISearchPage.test.tsx` (new)

| Test | Assertion |
|------|-----------|
| Renders textarea and Search button | Both visible on mount |
| Submit with empty query | Button disabled / no API call |
| Submit with valid query — loading state | Skeleton grid rendered while fetching |
| Successful response | Explanation callout + ListingCard grid rendered |
| `intent === 'fallback'` response | "Try standard search" fallback link visible |
| API error | Inline error message shown; fallback link visible |
| "Add to Cart" on a ListingCard | `cartStore.items` contains the listing |

Mock strategy: `msw` handlers for `POST /api/v1/ai/search` returning fixture `AISearchResponse`.

#### `apps/web/src/__tests__/CartPage.test.tsx` (new)

| Test | Assertion |
|------|-----------|
| Empty cart state | "Your cart is empty" message + /search link |
| Items displayed with correct subtotal | Math verified for 2-item cart |
| Fee row displays fetched fee_percent | "Service fee (7%)" shown |
| Remove item button | Item removed from store + UI updates |
| Quantity stepper increment | Quantity increases, subtotal recalculates |
| Quantity stepper at max (quantityAvailable) | Increment disabled |
| "Proceed to Checkout" → navigates to /checkout | `useNavigate` called with `/checkout` |

#### `apps/web/src/__tests__/CheckoutPage.test.tsx` (upgrade from M2-A stub)

| Test | Assertion |
|------|-----------|
| Calls `POST /orders` on mount with cart items | API called, `clientSecret` used to init Stripe Elements |
| Shows skeleton while order is being created | Skeleton visible during pending state |
| Insufficient stock error from API | Per-item error message shown |
| `PaymentElement` rendered after order created | Stripe component in DOM |
| Form submit — `stripe.confirmPayment` called | Mock Stripe SDK verify call |
| Payment success → calls `/confirm`, navigates to confirmation | Route change to `/orders/:id/confirmation` |
| Stripe error on confirm | Inline error shown; form remains open |

Mock strategy: mock `@stripe/react-stripe-js` with a stub `PaymentElement` and `useStripe`/`useElements` returning test doubles.

#### `apps/web/src/__tests__/OrderConfirmationPage.test.tsx` (new)

| Test | Assertion |
|------|-----------|
| Fetches order by ID and renders line items | Subtotal, fee, total all displayed |
| Subtotal + fee math is correct | 7% of $3.00 = $0.21, total $3.21 |
| Loading skeleton while fetching | Skeleton in DOM during pending |
| Order not found (404) | Redirects to `/` |
| "Continue Shopping" link → /search | Link present with correct href |

---

## Integration Checklist (end-to-end)

- [ ] Migration 004 applied; `\d orders` and `\d order_items` show correct schema
- [ ] Consumer types "Find me some zucchini" → AI search returns ≥1 listing with explanation
- [ ] Fallback: Claude unavailable → keyword search results returned, intent = 'fallback'
- [ ] Add listing to cart → cart badge in navbar shows count
- [ ] CartPage shows correct subtotal, 7% fee, and total
- [ ] Checkout: `POST /orders` creates Stripe PaymentIntent (visible in Stripe dashboard)
- [ ] Stripe test card `4242 4242 4242 4242` → payment succeeds
- [ ] `POST /orders/:id/confirm` → order `status = 'paid'`, `quantity_available` decremented in DB
- [ ] Order confirmation shows three line items: subtotal · fee · total
- [ ] Rate limit: 21st AI search in an hour → 429 response
- [ ] Producer token on `POST /orders` → 403
- [ ] Unauthenticated on `GET /orders` → 401

---

## File Change Summary

| File | Change |
|------|--------|
| `server/src/db/migrations/004_create_orders.sql` | **New** — orders + order_items tables |
| `packages/shared-types/src/index.ts` | Add AISearchRequest/Response, Order, OrderItem, CartItem, CreateOrderRequest |
| `server/src/prompts/searchSystem.txt` | **New** — Claude system prompt |
| `server/src/prompts/searchTool.json` | **New** — search_listings tool schema |
| `server/src/services/aiSearchService.ts` | **New** — Claude tool_use → listing query |
| `server/src/routes/ai.ts` | **New** — POST /ai/search with rate limiting |
| `server/src/routes/orders.ts` | **New** — POST / · POST /:id/confirm · GET / |
| `server/src/routes/admin.ts` | Add GET /admin/config (fee_percent) |
| `server/src/index.ts` | Wire ai + orders routers |
| `apps/web/src/pages/AISearchPage.tsx` | **New** — natural language search UI |
| `apps/web/src/stores/cartStore.ts` | **New** — Zustand cart with persistence |
| `apps/web/src/pages/CartPage.tsx` | **New** — cart review + fee display |
| `apps/web/src/pages/CheckoutPage.tsx` | **Upgrade** — full Stripe PaymentElement |
| `apps/web/src/pages/OrderConfirmationPage.tsx` | **New** — three-line-item confirmation |
| `apps/web/src/App.tsx` | Add /search, /cart, /checkout, /orders/:id/confirmation routes |

---

## Effort Estimate

| Track | Task | Time |
|-------|------|------|
| Backend | Migration 004 + shared types | 20 min |
| Backend | searchSystem.txt + searchTool.json | 15 min |
| Backend | aiSearchService.ts | 45 min |
| Backend | POST /ai/search route + rate limiter | 30 min |
| Backend | orders.ts (POST / + confirm + GET) | 60 min |
| Backend | admin GET /config | 15 min |
| Frontend | AISearchPage.tsx | 45 min |
| Frontend | cartStore.ts | 20 min |
| Frontend | CartPage.tsx | 40 min |
| Frontend | CheckoutPage.tsx (Stripe upgrade) | 50 min |
| Frontend | OrderConfirmationPage.tsx | 30 min |
| Frontend | App.tsx + navbar badge | 20 min |
| Tests | Backend (aiSearch + orders) | 60 min |
| Tests | Frontend (4 new test files) | 60 min |
| **Total** | | **~9 hours** |
