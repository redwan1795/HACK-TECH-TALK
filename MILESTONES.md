# Community Garden — Milestone Plan

**Team:** 2 developers  
**Total estimated effort:** 62–78 hours (~4 days)  
**Demo success criteria:**
1. **Scenario 1** — Consumer types "Find me some zucchini" → AI returns nearby listing → Stripe mock payment → platform fee visible on confirmation.
2. **Scenario 2** — Consumer posts "I need 10 oranges in 2 days" → producer publishes orange listing → consumer receives email notification.

---

## Milestone Overview

| # | Milestone | Key Features | Est. Hours | Status |
|---|-----------|--------------|-----------|--------|
| M0 | Scaffold + Foundation | Monorepo, OpenAPI spec, DB migrations, Docker | 8–10 | ⬜ Not started |
| M1 | Auth + Roles | JWT auth, role guards, login/register UI | 8–10 | ⬜ Not started |
| M2 | Listings + Search | Producer CRUD, ZIP/radius search, listing cards | 12–14 | ⬜ Not started |
| M3 | AI Search + Checkout | Claude search, Stripe payment, fee line item | 14–18 | ⬜ Not started |
| M4 | Future Orders + Notify | Demand signals, fanout matching, SendGrid email | 10–12 | ⬜ Not started |
| M5 | Polish + Demo Hardening | P1 stubs, error handling, demo seed data | 10–14 | ⬜ Not started |

---

## Critical Path

```
M0 → M1 → M2 → M3 → M4 → M5

Dev A (backend)  ──────────────────────────────────────────────►
Dev B (frontend) ──────────────────────────────────────────────►
                       ↑ parallel from M2 onward
         (OpenAPI spec is the interface contract between both tracks)
```

---

## M0 — Monorepo Scaffold + Contract-First Foundation

> **Goal:** Project skeleton, locked API contract, and running database — before any feature code is written.

**Entry criteria**
- Node 20+, PostgreSQL, Docker installed
- Stripe sandbox, Claude API, and SendGrid accounts provisioned

**Deliverables**

| What | Detail |
|------|--------|
| Monorepo root | Workspaces: `apps/web`, `apps/mobile`, `server`, `packages/shared-types` |
| `server/openapi.yaml` | Full OpenAPI 3.1 spec for all route groups (`auth`, `users`, `listings`, `orders`, `subscriptions`, `exchanges`, `future-orders`, `admin`, `ai`). P0 endpoints fully detailed; P1/P2 stubbed with `501`. |
| `packages/shared-types/index.ts` | TypeScript types matching OpenAPI schemas: `User`, `Listing`, `Order`, `FutureOrder`, `AISearchRequest`, `AISearchResponse` |
| `server/db/migrations/001–007_*.sql` | All 7 tables: `users`, `listings`, `orders`, `order_items`, `subscriptions`, `exchanges`, `future_orders`, `platform_config`. Indexes on `producer_id`, `location_zip`, `future_orders.status`. |
| `server/db/seed.sql` | 2 users, 3 listings, 1 `platform_config` row (`fee_percent = 7`) |
| `docker-compose.yml` | PostgreSQL 16 + Redis 7 |
| `apps/web/` | Vite + React + TypeScript + Tailwind + TanStack Query + Zustand scaffold |
| `apps/mobile/` | Expo React Native scaffold (dormant until M5) |
| `.env.example` | All required keys: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `SENDGRID_API_KEY` |

**Exit criteria**
- [ ] `docker compose up` → Postgres + Redis healthy
- [ ] `npm run migrate && npm run seed` → DB populated
- [ ] `GET /api/v1/listings` → returns seeded listings (no auth required)
- [ ] `openapi-validator` lint → zero errors
- [ ] Web app loads at `localhost:5173` with no console errors

**Parallel split:** Dev A → server scaffold + DB migrations · Dev B → OpenAPI spec + shared types + web scaffold

**Estimated effort:** 8–10 hours

---

## M1 — Authentication + Role System

> **Goal:** JWT-based auth with `consumer`, `producer`, `broker`, and `admin` roles gating all write endpoints from day one.

**FR covered:** FR-01

**Entry criteria**
- M0 exit criteria met
- `users` table migration applied

**Deliverables**

| What | Detail |
|------|--------|
| `POST /auth/register` | Accepts `{ email, password, role }`, bcrypt hash, returns JWT + user |
| `POST /auth/login` | Returns access token + refresh token |
| `POST /auth/refresh` | Refresh token rotation (stored in Redis with TTL) |
| `POST /auth/logout` | Invalidates refresh token in Redis |
| `server/middleware/authenticate.ts` | Verifies JWT, attaches `req.user` |
| `server/middleware/authorize.ts` | Role-guard factory: `authorize('producer')`, `authorize('admin')` |
| `server/middleware/rateLimiter.ts` | Redis-backed, 10 req/min per IP on auth endpoints |
| `apps/web/src/stores/authStore.ts` | Zustand with `login()`, `logout()`, `register()`, persisted to `localStorage` |
| `apps/web/src/pages/RegisterPage.tsx` | Email, password, role selector (Consumer / Producer / Broker) |
| `apps/web/src/pages/LoginPage.tsx` | Email + password, error messages |
| `apps/web/src/components/ProtectedRoute.tsx` | Role-aware guard, redirects to `/login` if unauthenticated |

**Exit criteria**
- [ ] Producer token → `POST /listings` returns 501 (stub, not 401)
- [ ] Consumer token → `POST /listings` returns 403
- [ ] Refresh flow: expired access token + valid refresh token → new access token issued
- [ ] Web: register → login → dashboard navigation with no console errors

**Estimated effort:** 8–10 hours

---

## M2 — Producer Listings + Keyword/Location Search

> **Goal:** Producers can create, publish, and manage listings with images. Consumers can browse and filter by keyword and ZIP radius — the fallback search path.

**FR covered:** FR-02, FR-03

**Entry criteria**
- M1 exit criteria met
- `listings` table migration applied

**Deliverables**

| What | Detail |
|------|--------|
| `server/routes/listings.ts` | `POST /` · `GET /` (search + filter) · `GET /:id` · `PUT /:id` · `DELETE /:id` (soft) · `PATCH /:id/publish` |
| `server/services/geocodeService.ts` | Zippopotam.us wrapper; Redis cache per ZIP (24h TTL) |
| `server/services/listingService.ts` | Haversine distance filtering, keyword query builder, image upload |
| Image upload | `multer` disk storage for dev (S3 presigned URLs optional in M5) |
| `apps/web/src/pages/ProducerDashboard.tsx` | Producer's own listings table + publish/unpublish controls |
| `apps/web/src/pages/CreateListingPage.tsx` | react-hook-form + zod, image drag-and-drop upload |
| `apps/web/src/pages/ListingsPage.tsx` | Keyword input + ZIP filter + radius slider + paginated card grid |
| `apps/web/src/components/ListingCard.tsx` | Reusable card: title · price · distance · image · "Add to Cart" — shared with AI search results |

**Search parameters supported**

```
GET /api/v1/listings?q=zucchini&zip=88001&radius_miles=25&category=vegetable&page=1&limit=20
```

**Exit criteria**
- [ ] Producer creates "Zucchini — $3/lb, 10 lbs, ZIP 88001" listing with photo and publishes it
- [ ] `GET /listings?q=zucchini&zip=88001&radius_miles=10` returns that listing with `distance_miles` field
- [ ] Listings more than 10 miles away excluded from results
- [ ] `ListingCard` renders title, price, distance, and image

**Parallel split:** Dev A → backend CRUD + geocode service (~6h) · Dev B → frontend listing pages (~6–8h)

**Estimated effort:** 12–14 hours

---

## M3 — AI Natural-Language Search + Checkout + Payment

> **Goal:** Primary discovery interface live. Consumer types plain language, Claude extracts intent and returns ranked listings. Stripe sandbox checkout with visible platform fee completes Demo Scenario 1.

**FR covered:** FR-04, FR-08

**Entry criteria**
- M2 exit criteria met
- ≥5 seeded listings with varied categories and locations
- Claude API key and Stripe sandbox keys configured
- `orders` + `order_items` tables migrated

**Deliverables**

| What | Detail |
|------|--------|
| `server/prompts/searchSystem.txt` | System prompt instructing Claude to call the `search_listings` tool |
| `server/services/aiSearchService.ts` | Claude `tool_use` → extract `{ keyword, category, zip, radius_miles, max_price }` → listing query → returns `{ intent, results, explanation }` |
| `POST /api/v1/ai/search` | Authenticated; rate-limited 20 req/user/hour; body `{ query, user_zip? }`; falls back to keyword search on Claude error |
| `apps/web/src/pages/AISearchPage.tsx` | Home route `/`; large prompt input; loading skeleton; ListingCard grid with AI explanation; fallback "Try standard search" link on error |
| `apps/web/src/stores/cartStore.ts` | Zustand `{ items, addItem(), removeItem(), clearCart() }` |
| `apps/web/src/pages/CartPage.tsx` | Items, subtotal, estimated fee (fetched from `GET /admin/config`) |
| `server/routes/orders.ts` | `POST /` (validate stock, compute fee server-side, create Stripe PaymentIntent) · `POST /:id/confirm` (status → `paid`, decrement stock) · `GET /` |
| `apps/web/src/pages/CheckoutPage.tsx` | Stripe `PaymentElement`; on success calls `/confirm` |
| `apps/web/src/pages/OrderConfirmationPage.tsx` | Subtotal · platform fee · total — all as separate line items |

> **Critical rule:** Platform fee is computed server-side only. The client displays what the server returns — never the reverse.

**Exit criteria — Demo Scenario 1**
- [ ] Consumer types "Find me some zucchini" → AI returns listing + explanation string
- [ ] Add to cart → checkout → Stripe test card `4242 4242 4242 4242` → payment succeeds
- [ ] Order confirmation shows platform fee line item (e.g., 7% = $0.21 on $3 order)
- [ ] `listings.quantity_available` decremented in DB after confirmed order

**Estimated effort:** 14–18 hours

---

## M4 — Future Orders + Notifications

> **Goal:** Consumers post a demand signal in natural language. When a matching producer listing is published within the proximity and time window, the consumer is notified. Completes Demo Scenario 2.

**FR covered:** FR-11

**Entry criteria**
- M3 exit criteria met
- `future_orders` table migrated
- SendGrid API key configured (use `mailtrap.io` for demo inbox capture)

**Deliverables**

| What | Detail |
|------|--------|
| `server/prompts/demandParseSystem.txt` | System prompt for demand intent extraction |
| `server/services/demandParseService.ts` | Claude `tool_use` with `create_future_order` tool → `{ product_keyword, quantity, unit, needed_by_date (ISO 8601), max_price, zip }`; relative dates normalized via `date-fns` |
| `POST /api/v1/ai/parse-demand` | Consumer-only; returns parsed intent for frontend confirmation step (does not save to DB yet) |
| `server/routes/future-orders.ts` | `POST /` (save confirmed demand as `open`) · `GET /` · `DELETE /:id` (cancel) |
| `server/jobs/listingPublishFanout.ts` | Triggered via `setImmediate` when listing → `active`; queries open `future_orders` matching keyword + proximity; calls `notificationService.sendFutureOrderMatch()`; updates matched records to `status: 'matched'` |
| `server/services/notificationService.ts` | SendGrid wrapper; `sendFutureOrderMatch(futureOrder, listing)` sends email with listing title and direct link |
| `apps/web/src/pages/FutureOrderPage.tsx` | Freetext input → `POST /ai/parse-demand` → confirmation card → `POST /future-orders` → success state |
| `apps/web/src/pages/FutureOrdersListPage.tsx` | Consumer's open demands with `open` / `matched` / `expired` status badges |

**Exit criteria — Demo Scenario 2**
- [ ] Consumer submits "I need 10 oranges in 2 days near 88001" → parsed intent shown → confirmed → saved as `open`
- [ ] Producer logs in, creates and publishes "Navel Oranges" listing (ZIP 88001)
- [ ] Consumer receives email within seconds of listing being published
- [ ] `future_orders` record shows `status: 'matched'` and `matched_listing_id` set in DB

**Estimated effort:** 10–12 hours

---

## M5 — P1/P2 Stubs + Polish + Demo Hardening

> **Goal:** Add highest-value P1 features as working stubs, harden both demo scenarios for a zero-error live presentation.

**FR covered:** FR-05 (partial), FR-06 (stub), FR-07 (stub), FR-09, FR-10

**Entry criteria**
- M4 exit criteria met
- Both demo scenarios rehearsed end-to-end at least once
- No open P0 bugs

**Deliverables**

| What | Detail |
|------|--------|
| **Subscriptions (FR-05)** | `POST /api/v1/subscriptions` creates Stripe subscription in sandbox; `SubscriptionModal` on `ListingDetailPage` with cadence selector |
| **Admin fee config (FR-09/FR-10)** | `PATCH /api/v1/admin/config` (admin-only); `AdminConfigPage` — fee % form with live save |
| **Broker stub (FR-07)** | Broker dashboard page exists with "Coming soon" placeholder |
| **Exchange stub (FR-06)** | `/exchange` route with placeholder card — no backend work |
| **Error resilience** | Global Express error handler `{ error: { code, message } }`; error boundaries on AI search + checkout pages; `NotFoundPage` (404) |
| **Loading states** | Skeletons on all data-fetching pages; no layout shift |
| **Demo seed** | `demo/seed-data.sql` — deterministic data matching both demo scripts (exact ZIPs, product names, accounts) |
| **Demo scripts** | `demo/scenario1.md` + `demo/scenario2.md` — step-by-step click paths with timing targets |
| **Offline backup** | Cache last AI search response in Zustand; prepare screen-recorded backup of each scenario |

**Exit criteria**
- [ ] Demo Scenario 1 completes end-to-end in **< 90 seconds**, zero console errors
- [ ] Demo Scenario 2 completes end-to-end in **< 60 seconds**, email delivered to mailtrap inbox
- [ ] Admin changes fee % in UI → immediately reflected in the next order's fee calculation
- [ ] All protected routes return 401 (no token) or 403 (wrong role) consistently

**Estimated effort:** 10–14 hours

---

## Effort Summary

| Milestone | Focus | Est. Hours | Dependencies |
|-----------|-------|-----------|--------------|
| M0 | Scaffold + OpenAPI + DB | 8–10 | — |
| M1 | Auth + roles | 8–10 | M0 |
| M2 | Listings + geo search | 12–14 | M1 |
| M3 | AI search + Stripe checkout | 14–18 | M2 + API keys |
| M4 | Future Orders + notifications | 10–12 | M3 + SendGrid key |
| M5 | P1 stubs + polish + demo | 10–14 | M4 |
| **Total** | | **62–78 hours** | |

---

## Key Files Per Milestone

| Milestone | Critical Backend Files | Critical Frontend Files |
|-----------|----------------------|------------------------|
| M0 | `server/openapi.yaml` · `server/db/migrations/001–007_*.sql` · `docker-compose.yml` | `packages/shared-types/index.ts` · `apps/web/src/main.tsx` |
| M1 | `server/routes/auth.ts` · `server/middleware/authenticate.ts` · `server/middleware/authorize.ts` | `apps/web/src/stores/authStore.ts` · `LoginPage.tsx` · `RegisterPage.tsx` |
| M2 | `server/routes/listings.ts` · `server/services/geocodeService.ts` · `server/services/listingService.ts` | `ListingsPage.tsx` · `CreateListingPage.tsx` · `ListingCard.tsx` |
| M3 | `server/services/aiSearchService.ts` · `server/prompts/searchSystem.txt` · `server/routes/orders.ts` | `AISearchPage.tsx` · `CheckoutPage.tsx` · `OrderConfirmationPage.tsx` |
| M4 | `server/services/demandParseService.ts` · `server/jobs/listingPublishFanout.ts` · `server/services/notificationService.ts` | `FutureOrderPage.tsx` · `FutureOrdersListPage.tsx` |
| M5 | `server/routes/subscriptions.ts` · error handler middleware | `AdminConfigPage.tsx` · `demo/seed-data.sql` · `demo/scenario1.md` · `demo/scenario2.md` |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Claude API latency (2–4s per call) | AI search feels slow | Show loading skeleton immediately; cache last result in Zustand for offline replay |
| Demo WiFi unreliable | Live demo fails | Screen-record both scenarios in advance as backup |
| SendGrid delivery delay | Notification demo stalls | Use `mailtrap.io` for instant inbox capture in demo environment |
| Schema churn after M0 | Breaks other developers' local DB | Never edit existing migration files; add `00N_alter_*.sql` for any schema changes |
| Mobile scope creep | Delays demo hardening | Mobile is stretch — do not start until both demo scenarios pass cleanly |
| Stripe webhook unreliable locally | Payment flow incomplete | Call `/confirm` directly from frontend on `paymentIntent.status === 'succeeded'` |

---

## Verification Checklist (pre-demo)

```
Environment
  [ ] docker compose up → Postgres + Redis healthy
  [ ] npm run migrate + npm run seed → DB populated
  [ ] demo/seed-data.sql loaded (specific accounts + listings)

Demo Scenario 1 — AI Search → Checkout
  [ ] Consumer logs in
  [ ] Types "Find me some zucchini" → results appear with explanation
  [ ] Add to cart → checkout → Stripe test card → payment succeeds
  [ ] Order confirmation shows subtotal, fee %, and total as separate line items
  [ ] DB: order status = paid, listing quantity decremented
  [ ] Total time < 90 seconds

Demo Scenario 2 — Future Order → Notification
  [ ] Consumer submits "I need 10 oranges in 2 days" → parsed intent confirmed → saved
  [ ] Producer publishes Navel Oranges listing (ZIP 88001)
  [ ] Email arrives in mailtrap inbox within 10 seconds
  [ ] DB: future_order status = matched, matched_listing_id set
  [ ] Total time < 60 seconds

Platform fee admin
  [ ] Admin changes fee % → new order reflects updated rate

Security spot-check
  [ ] Consumer token cannot access producer-only endpoints (403)
  [ ] No auth token → write endpoints return 401
```
