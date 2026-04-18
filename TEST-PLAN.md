# Community Garden — Detailed Test Plan

**Document purpose:** Define the full testing strategy covering unit, integration, end-to-end, UI, accessibility, security, performance, and non-functional testing for the Community Garden platform. Organized by milestone and requirement ID.

**Platforms under test:** Web application (React), Mobile application (React Native / Expo), Backend API (Node.js / Express)

---

## Table of Contents

1. [Testing Strategy Overview](#1-testing-strategy-overview)
2. [Test Environment Setup](#2-test-environment-setup)
3. [Milestone M0 — Scaffold & Foundation Tests](#3-milestone-m0--scaffold--foundation-tests)
4. [Milestone M1 — Authentication & Role Tests (FR-01)](#4-milestone-m1--authentication--role-tests-fr-01)
5. [Milestone M2 — Listings & Search Tests (FR-02, FR-03)](#5-milestone-m2--listings--search-tests-fr-02-fr-03)
6. [Milestone M3 — AI Search & Checkout Tests (FR-04, FR-08)](#6-milestone-m3--ai-search--checkout-tests-fr-04-fr-08)
7. [Milestone M4 — Future Orders & Notification Tests (FR-11)](#7-milestone-m4--future-orders--notification-tests-fr-11)
8. [Milestone M5 — P1/P2 Feature Tests (FR-05, FR-06, FR-07, FR-09, FR-10)](#8-milestone-m5--p1p2-feature-tests-fr-05-fr-06-fr-07-fr-09-fr-10)
9. [Non-Functional Requirements Tests (NFR-01 to NFR-05)](#9-non-functional-requirements-tests-nfr-01-to-nfr-05)
10. [UI & Visual Regression Tests](#10-ui--visual-regression-tests)
11. [Accessibility Testing (NFR-04)](#11-accessibility-testing-nfr-04)
12. [Security Testing (NFR-03)](#12-security-testing-nfr-03)
13. [Performance & Load Testing](#13-performance--load-testing)
14. [Demo Scenario Acceptance Tests](#14-demo-scenario-acceptance-tests)
15. [Test Coverage Targets](#15-test-coverage-targets)
16. [Defect Triage & Severity Levels](#16-defect-triage--severity-levels)

---

## 1. Testing Strategy Overview

### Testing Pyramid

```
                  ┌─────────────┐
                  │  E2E Tests  │  ← Playwright / Detox (few, high-value)
                  │  (~10–15)   │
                ┌─┴─────────────┴─┐
                │ Integration Tests│  ← Supertest API tests (medium)
                │   (~40–60)      │
              ┌─┴─────────────────┴─┐
              │    Unit Tests        │  ← Jest / Vitest (many, fast)
              │    (~100–150)        │
              └─────────────────────┘
```

### Test Types and Tools

| Type | Tool | Scope |
|------|------|-------|
| **Unit — Backend** | Jest + ts-jest | Services, utilities, fee calc, geo, AI response parsers |
| **Unit — Frontend** | Vitest + React Testing Library | Components, stores, hooks, form validation |
| **Integration — API** | Jest + Supertest + test DB | Full HTTP request/response cycles against real PostgreSQL |
| **E2E — Web** | Playwright | Critical user flows in real browser |
| **E2E — Mobile** | Expo + Detox (stretch) | Critical flows on iOS simulator |
| **Contract** | openapi-validator | Every API response matches OpenAPI spec |
| **Accessibility** | axe-core + Playwright | WCAG 2.1 AA automated checks |
| **Security** | OWASP ZAP (manual scan) + custom test cases | Auth, injection, rate limiting |
| **Performance** | k6 | API throughput, AI endpoint latency |
| **Visual Regression** | Playwright screenshots | UI consistency across changes |

### Test Data Strategy

- All integration and E2E tests run against a **dedicated test database** (separate `DATABASE_URL_TEST`).
- Each test suite wraps its data in a **transaction that rolls back** after the test, keeping tests isolated.
- A shared **factory module** (`server/tests/factories.ts`) creates users, listings, orders, and future orders with sensible defaults overridable per test.
- The Claude API and SendGrid are **mocked** in unit and integration tests using Jest `jest.mock()` / `msw` (Mock Service Worker). Real API calls only happen in the manual E2E / demo run.

---

## 2. Test Environment Setup

### Required Configuration

```bash
# .env.test
DATABASE_URL_TEST=postgres://localhost:5432/community_garden_test
REDIS_URL=redis://localhost:6379/1        # DB 1 to isolate from dev
JWT_SECRET=test-secret-do-not-use-in-prod
STRIPE_SECRET_KEY=sk_test_...            # Stripe sandbox
ANTHROPIC_API_KEY=                       # Mocked in unit/integration
SENDGRID_API_KEY=                        # Mocked in unit/integration
```

### Setup Scripts

```bash
npm run test:setup       # Create test DB, run migrations, seed base data
npm run test             # All unit + integration tests
npm run test:e2e         # Playwright E2E tests (requires running server)
npm run test:coverage    # Tests with coverage report
npm run test:watch       # Watch mode for TDD
```

### CI Pipeline (GitHub Actions)

```
on: [push, pull_request]
jobs:
  test:
    - Spin up postgres:16 + redis:7 as services
    - npm run test:setup
    - npm run test
    - npm run test:coverage (fail if below thresholds)
  e2e:
    - npm run build
    - npm run start:test
    - npm run test:e2e
```

---

## 3. Milestone M0 — Scaffold & Foundation Tests

### 3.1 Database Migration Tests

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| M0-DB-01 | All 7 migration files run without error on a clean DB | Integration | Exit code 0, all tables exist |
| M0-DB-02 | All expected indexes exist after migration | Integration | `pg_indexes` query returns correct index names |
| M0-DB-03 | Migrations are idempotent — running twice does not error | Integration | Second run exits 0 with "already applied" output |
| M0-DB-04 | `platform_config` seed row exists with `fee_percent` key | Integration | `SELECT value FROM platform_config WHERE key = 'fee_percent'` returns a numeric string |
| M0-DB-05 | Foreign key constraints enforced (e.g., order with invalid consumer_id) | Integration | INSERT with non-existent FK throws `23503` FK violation |

### 3.2 OpenAPI Spec Tests

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| M0-API-01 | OpenAPI spec passes `@apidevtools/swagger-parser` validation | CI lint | Zero errors, zero warnings |
| M0-API-02 | All documented request schemas have `required` fields specified | Static | Schema review — no `required` array missing on request bodies |
| M0-API-03 | All documented response schemas include at least one `200` or `201` definition | Static | Schema review |
| M0-API-04 | Stub endpoints return `501 Not Implemented` | Integration | `POST /api/v1/subscriptions` → 501 before M5 |

### 3.3 Docker / Infrastructure Tests

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| M0-INF-01 | `docker compose up` starts Postgres and Redis within 30s | Manual | Both services show `healthy` in `docker compose ps` |
| M0-INF-02 | Web app builds without TypeScript errors | CI | `tsc --noEmit` exits 0 |
| M0-INF-03 | Shared types package exports compile without errors | CI | `tsc --noEmit` in `packages/shared-types` exits 0 |

---

## 4. Milestone M1 — Authentication & Role Tests (FR-01)

### 4.1 Unit Tests — AuthService

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M1-U-01 | `hashPassword()` returns a bcrypt hash (not plaintext) | `authService.test.ts` | Result starts with `$2b$` |
| M1-U-02 | `verifyPassword()` returns true for correct password | `authService.test.ts` | Returns `true` |
| M1-U-03 | `verifyPassword()` returns false for wrong password | `authService.test.ts` | Returns `false` |
| M1-U-04 | `generateToken()` returns a valid JWT with correct `sub` and `role` claims | `authService.test.ts` | `jwt.verify()` succeeds; decoded payload has correct fields |
| M1-U-05 | `generateToken()` sets expiry to 15 minutes | `authService.test.ts` | `exp - iat === 900` |
| M1-U-06 | `generateRefreshToken()` returns a unique token each call | `authService.test.ts` | Two calls return different values |

### 4.2 Unit Tests — Middleware

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M1-U-07 | `authenticate` middleware passes with valid Bearer token | `authenticate.test.ts` | `next()` called; `req.user` populated |
| M1-U-08 | `authenticate` middleware returns 401 with no Authorization header | `authenticate.test.ts` | Response status 401 |
| M1-U-09 | `authenticate` middleware returns 401 with expired token | `authenticate.test.ts` | Response status 401, body includes `TOKEN_EXPIRED` code |
| M1-U-10 | `authenticate` middleware returns 401 with tampered token signature | `authenticate.test.ts` | Response status 401 |
| M1-U-11 | `authorize('producer')` passes for producer role | `authorize.test.ts` | `next()` called |
| M1-U-12 | `authorize('producer')` returns 403 for consumer role | `authorize.test.ts` | Response status 403 |
| M1-U-13 | `authorize('admin')` returns 403 for producer role | `authorize.test.ts` | Response status 403 |

### 4.3 Integration Tests — Auth Routes

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M1-I-01 | `POST /auth/register` creates user, returns 201 with token | `auth.test.ts` | 201; body has `token`, `user.id`, `user.role` |
| M1-I-02 | `POST /auth/register` with duplicate email returns 409 | `auth.test.ts` | 409; body has `USER_EXISTS` error code |
| M1-I-03 | `POST /auth/register` with missing `role` field returns 400 | `auth.test.ts` | 400 validation error |
| M1-I-04 | `POST /auth/register` with invalid email format returns 400 | `auth.test.ts` | 400 validation error |
| M1-I-05 | `POST /auth/login` with correct credentials returns 200 and token | `auth.test.ts` | 200; body has `access_token`, `refresh_token` |
| M1-I-06 | `POST /auth/login` with wrong password returns 401 | `auth.test.ts` | 401; `INVALID_CREDENTIALS` code |
| M1-I-07 | `POST /auth/login` with non-existent email returns 401 | `auth.test.ts` | 401 (do not reveal whether email exists) |
| M1-I-08 | `POST /auth/refresh` with valid refresh token returns new access token | `auth.test.ts` | 200; new `access_token` different from old one |
| M1-I-09 | `POST /auth/refresh` with already-used refresh token returns 401 | `auth.test.ts` | 401; `REFRESH_TOKEN_REUSED` |
| M1-I-10 | `POST /auth/logout` invalidates refresh token | `auth.test.ts` | Subsequent `/refresh` with same token → 401 |
| M1-I-11 | Rate limiter blocks >10 login attempts per minute from same IP | `auth.test.ts` | 11th request returns 429 |

### 4.4 Frontend Unit Tests — Auth Store & Components

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M1-F-01 | `authStore.login()` stores token and user in Zustand state | `authStore.test.ts` | `getState().user` populated after login call |
| M1-F-02 | `authStore.logout()` clears user and token | `authStore.test.ts` | `getState().user === null` after logout |
| M1-F-03 | `ProtectedRoute` renders children when authenticated | `ProtectedRoute.test.tsx` | Child component visible |
| M1-F-04 | `ProtectedRoute` redirects to `/login` when unauthenticated | `ProtectedRoute.test.tsx` | `navigate('/login')` called |
| M1-F-05 | `ProtectedRoute` redirects to `/` when authenticated user lacks required role | `ProtectedRoute.test.tsx` | `navigate('/')` called |
| M1-F-06 | `RegisterPage` shows validation errors for empty fields on submit | `RegisterPage.test.tsx` | Error messages visible in DOM |
| M1-F-07 | `RegisterPage` calls register API mutation on valid form submission | `RegisterPage.test.tsx` | Mock API function called with correct payload |
| M1-F-08 | `LoginPage` shows error message on 401 response | `LoginPage.test.tsx` | "Invalid credentials" text visible |

---

## 5. Milestone M2 — Listings & Search Tests (FR-02, FR-03)

### 5.1 Unit Tests — Geocode Service

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M2-U-01 | `geocodeZip('88001')` returns lat/lng for Las Cruces, NM | `geocodeService.test.ts` | Returns `{ lat: ~32.3, lng: ~-106.7 }` (mocked API) |
| M2-U-02 | `geocodeZip()` returns cached result on second call (no HTTP call) | `geocodeService.test.ts` | External API mock called exactly once across two calls |
| M2-U-03 | `geocodeZip()` with unknown ZIP returns null | `geocodeService.test.ts` | Returns `null`; no thrown error |
| M2-U-04 | Haversine distance between same point is 0 | `geoUtils.test.ts` | Returns `0` |
| M2-U-05 | Haversine distance between NYC and LA is ~2,445 miles ± 5 | `geoUtils.test.ts` | Result within expected range |
| M2-U-06 | Bounding-box pre-filter correctly excludes coordinates outside radius | `geoUtils.test.ts` | Points > 1.5× radius excluded |

### 5.2 Unit Tests — Listing Service

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M2-U-07 | `buildSearchQuery()` includes keyword in SQL ILIKE clause | `listingService.test.ts` | Generated query contains `ILIKE '%zucchini%'` |
| M2-U-08 | `buildSearchQuery()` filters by category when provided | `listingService.test.ts` | Query contains `category = 'vegetable'` |
| M2-U-09 | `buildSearchQuery()` excludes unavailable listings (`is_available = false`) | `listingService.test.ts` | Query always includes `is_available = true` |
| M2-U-10 | `computePlatformFee()` calculates floor correctly for 7% of $5.00 | `feeService.test.ts` | Returns `35` (cents), not `35.0` |
| M2-U-11 | `computePlatformFee()` for 0 subtotal returns 0 | `feeService.test.ts` | Returns `0` |

### 5.3 Integration Tests — Listing Routes

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M2-I-01 | `POST /listings` as producer creates listing and returns 201 | `listings.test.ts` | 201; body has `listing_id`, all submitted fields |
| M2-I-02 | `POST /listings` as consumer returns 403 | `listings.test.ts` | 403 |
| M2-I-03 | `POST /listings` with missing `title` returns 400 | `listings.test.ts` | 400 validation error |
| M2-I-04 | `POST /listings` with negative `price_cents` returns 400 | `listings.test.ts` | 400 validation error |
| M2-I-05 | `GET /listings` returns only `is_available = true` listings | `listings.test.ts` | Unavailable listing absent from results |
| M2-I-06 | `GET /listings?q=zucchini` returns only listings matching keyword | `listings.test.ts` | Non-matching listings absent |
| M2-I-07 | `GET /listings?zip=88001&radius_miles=5` excludes listing 30 miles away | `listings.test.ts` | Only near listings present; far listing absent |
| M2-I-08 | `GET /listings?zip=88001&radius_miles=5` includes listing 3 miles away | `listings.test.ts` | Near listing present with `distance_miles` field |
| M2-I-09 | `GET /listings?category=fruit` returns only fruit listings | `listings.test.ts` | All results have `category === 'fruit'` |
| M2-I-10 | `GET /listings?page=2&limit=2` returns correct page slice | `listings.test.ts` | Returns items 3–4; `total_count` correct |
| M2-I-11 | `PUT /listings/:id` updates listing when called by owning producer | `listings.test.ts` | 200; updated fields reflected |
| M2-I-12 | `PUT /listings/:id` returns 403 when called by different producer | `listings.test.ts` | 403 |
| M2-I-13 | `DELETE /listings/:id` soft-deletes listing (sets `deleted_at`) | `listings.test.ts` | Listing absent from `GET /listings`; row has `deleted_at` set |
| M2-I-14 | `PATCH /listings/:id/publish` changes status to `active` | `listings.test.ts` | 200; `status: 'active'` in response |
| M2-I-15 | `GET /listings/:id` for non-existent ID returns 404 | `listings.test.ts` | 404 with `LISTING_NOT_FOUND` code |

### 5.4 Frontend Tests — Listing Pages

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M2-F-01 | `ListingCard` renders title, price, distance, and image alt text | `ListingCard.test.tsx` | All fields present in rendered DOM |
| M2-F-02 | `ListingCard` shows "Exchange only" when `price_cents` is null | `ListingCard.test.tsx` | "Exchange only" text visible |
| M2-F-03 | `CreateListingPage` disables submit button while API call is in flight | `CreateListingPage.test.tsx` | Button has `disabled` attribute during pending state |
| M2-F-04 | `CreateListingPage` shows server error message on 400 response | `CreateListingPage.test.tsx` | Error text rendered below form |
| M2-F-05 | `ListingsPage` renders a card for each listing returned by API | `ListingsPage.test.tsx` | Card count matches mock data length |
| M2-F-06 | `ListingsPage` ZIP input triggers new API call with updated zip param | `ListingsPage.test.tsx` | Mock API called with new `zip` value after input change |
| M2-F-07 | `ListingsPage` shows empty state when no results returned | `ListingsPage.test.tsx` | "No listings found" text visible |

---

## 6. Milestone M3 — AI Search & Checkout Tests (FR-04, FR-08)

### 6.1 Unit Tests — AI Search Service

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M3-U-01 | `parseAISearchResponse()` extracts keyword from Claude tool-call JSON | `aiSearchService.test.ts` | `result.keyword === 'zucchini'` |
| M3-U-02 | `parseAISearchResponse()` extracts category when present | `aiSearchService.test.ts` | `result.category === 'vegetable'` |
| M3-U-03 | `parseAISearchResponse()` handles missing optional fields gracefully | `aiSearchService.test.ts` | No throw; optional fields are `undefined` |
| M3-U-04 | `parseAISearchResponse()` throws `AIParseError` on malformed JSON | `aiSearchService.test.ts` | Error is instance of `AIParseError`; not unhandled |
| M3-U-05 | AI search service falls back to keyword search when Claude returns no tool call | `aiSearchService.test.ts` | `listingService.search()` called with raw query string |
| M3-U-06 | AI search service falls back to keyword search on Claude API timeout | `aiSearchService.test.ts` | Fallback triggered; no 500 error propagated |
| M3-U-07 | System prompt file is loaded and cached — not re-read on every call | `aiSearchService.test.ts` | File read called once; second call uses cache |

### 6.2 Unit Tests — Order / Fee Service

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M3-U-08 | `FeeService.compute(500, 7)` returns `{ fee: 35, total: 535 }` | `feeService.test.ts` | Exact values match |
| M3-U-09 | `FeeService.compute()` uses floor (not round) for fee cents | `feeService.test.ts` | $1.01 × 7% = 7.07¢ → fee = 7 (floor) |
| M3-U-10 | `FeeService.compute()` reads fee % from `platform_config`, not hardcoded | `feeService.test.ts` | Changing mock DB value changes output |
| M3-U-11 | `OrderService.validateStock()` throws when requested qty > available qty | `orderService.test.ts` | Throws `InsufficientStockError` |
| M3-U-12 | `OrderService.validateStock()` passes when requested qty ≤ available qty | `orderService.test.ts` | No throw |
| M3-U-13 | `OrderService.decrementStock()` correctly reduces `quantity_available` | `orderService.test.ts` | DB value decremented by exact ordered quantity |

### 6.3 Integration Tests — AI Route + Order Routes

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M3-I-01 | `POST /ai/search` returns listings matching parsed intent (Claude mocked) | `ai.test.ts` | 200; `results` array contains matching listings; `explanation` is non-empty string |
| M3-I-02 | `POST /ai/search` without auth returns 401 | `ai.test.ts` | 401 |
| M3-I-03 | `POST /ai/search` with empty `query` returns 400 | `ai.test.ts` | 400 validation error |
| M3-I-04 | `POST /ai/search` returns fallback results when Claude mock returns error | `ai.test.ts` | 200 (not 500); results based on raw keyword |
| M3-I-05 | `POST /ai/search` is rate-limited to 20 req/user/hour | `ai.test.ts` | 21st request returns 429 |
| M3-I-06 | `POST /orders` creates order with server-computed fee | `orders.test.ts` | 201; `platform_fee_cents = floor(subtotal * fee/100)`; fee NOT from request body |
| M3-I-07 | `POST /orders` with out-of-stock listing returns 422 | `orders.test.ts` | 422; `INSUFFICIENT_STOCK` code |
| M3-I-08 | `POST /orders` with non-existent listing_id returns 404 | `orders.test.ts` | 404 |
| M3-I-09 | `POST /orders/:id/confirm` updates order status to `paid` | `orders.test.ts` | 200; `status: 'paid'` |
| M3-I-10 | `POST /orders/:id/confirm` decrements listing `quantity_available` | `orders.test.ts` | Listing qty reduced by ordered amount |
| M3-I-11 | `POST /orders/:id/confirm` returns 404 for non-existent order | `orders.test.ts` | 404 |
| M3-I-12 | `POST /orders/:id/confirm` returns 403 if consumer_id doesn't match | `orders.test.ts` | 403 |
| M3-I-13 | `GET /orders` returns only the requesting consumer's orders | `orders.test.ts` | Orders belonging to other users absent |

### 6.4 Frontend Tests — AI Search & Checkout

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M3-F-01 | `AISearchPage` shows loading skeleton while API call is in flight | `AISearchPage.test.tsx` | Skeleton visible during pending state |
| M3-F-02 | `AISearchPage` renders explanation text above listing cards | `AISearchPage.test.tsx` | Explanation string rendered; `ListingCard` components present |
| M3-F-03 | `AISearchPage` shows fallback link on API error | `AISearchPage.test.tsx` | "Try standard search" link visible |
| M3-F-04 | `AISearchPage` does not submit empty query | `AISearchPage.test.tsx` | API not called on empty submit |
| M3-F-05 | `cartStore.addItem()` increases item count | `cartStore.test.ts` | `items.length === 1` after first add |
| M3-F-06 | `cartStore.addItem()` with duplicate listing_id increases quantity | `cartStore.test.ts` | Single item with `quantity === 2` |
| M3-F-07 | `CartPage` displays correct subtotal and estimated fee | `CartPage.test.tsx` | Rendered amounts match cart state × fee % from API |
| M3-F-08 | `CheckoutPage` renders Stripe `PaymentElement` | `CheckoutPage.test.tsx` | Stripe iframe present in DOM |
| M3-F-09 | `OrderConfirmationPage` renders subtotal, fee, and total line items | `OrderConfirmationPage.test.tsx` | All three monetary values visible |
| M3-F-10 | `OrderConfirmationPage` total = subtotal + fee | `OrderConfirmationPage.test.tsx` | Arithmetic verified in test assertion |

---

## 7. Milestone M4 — Future Orders & Notification Tests (FR-11)

### 7.1 Unit Tests — Demand Parse Service

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M4-U-01 | `parseDemandIntent()` extracts product keyword from "I need 10 oranges" | `demandParseService.test.ts` | `result.product_keyword === 'oranges'` |
| M4-U-02 | `parseDemandIntent()` extracts quantity from "10 oranges" | `demandParseService.test.ts` | `result.quantity === 10` |
| M4-U-03 | `parseDemandIntent()` converts relative date "in 2 days" to ISO 8601 timestamp | `demandParseService.test.ts` | `result.needed_by_date` is valid ISO string ~48h from now |
| M4-U-04 | `parseDemandIntent()` handles prompt with no date (returns null for `needed_by_date`) | `demandParseService.test.ts` | `needed_by_date === null`; no throw |
| M4-U-05 | `parseDemandIntent()` handles Claude API error with a thrown `DemandParseError` | `demandParseService.test.ts` | Error is `DemandParseError`; not generic crash |

### 7.2 Unit Tests — Future Order Fanout

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M4-U-06 | `matchFutureOrders()` returns matching open orders for a given listing | `listingPublishFanout.test.ts` | Returns demand with matching keyword and within proximity |
| M4-U-07 | `matchFutureOrders()` excludes expired future orders | `listingPublishFanout.test.ts` | Order with `expires_at` in past absent from results |
| M4-U-08 | `matchFutureOrders()` excludes future orders already matched | `listingPublishFanout.test.ts` | `status: 'matched'` orders absent |
| M4-U-09 | `matchFutureOrders()` excludes orders outside proximity radius | `listingPublishFanout.test.ts` | Order 50 miles away (radius 25) absent |
| M4-U-10 | `matchFutureOrders()` is case-insensitive on product keyword | `listingPublishFanout.test.ts` | "Orange" matches "orange" listing |
| M4-U-11 | `matchFutureOrders()` matches by category when keyword is generic (e.g., "fruit") | `listingPublishFanout.test.ts` | Orange listing (category: fruit) matches "fruit" demand |

### 7.3 Unit Tests — Notification Service

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M4-U-12 | `sendFutureOrderMatch()` calls SendGrid `send()` with correct to/subject/body | `notificationService.test.ts` | Mock `sgMail.send` called once with consumer email |
| M4-U-13 | `sendFutureOrderMatch()` email body includes listing title and link | `notificationService.test.ts` | Email HTML contains listing title string |
| M4-U-14 | `sendFutureOrderMatch()` does not throw on SendGrid API error (fire-and-forget) | `notificationService.test.ts` | No unhandled promise rejection; error logged |

### 7.4 Integration Tests — Future Order Routes & Fanout

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M4-I-01 | `POST /ai/parse-demand` returns parsed intent (Claude mocked) | `futureOrders.test.ts` | 200; `product_keyword`, `quantity`, `needed_by_date` present |
| M4-I-02 | `POST /ai/parse-demand` without auth returns 401 | `futureOrders.test.ts` | 401 |
| M4-I-03 | `POST /ai/parse-demand` as producer returns 403 | `futureOrders.test.ts` | 403 |
| M4-I-04 | `POST /future-orders` creates demand with `status: 'open'` | `futureOrders.test.ts` | 201; `status: 'open'` in DB |
| M4-I-05 | `POST /future-orders` with `expires_at` in the past returns 400 | `futureOrders.test.ts` | 400; `INVALID_EXPIRY` |
| M4-I-06 | `GET /future-orders` returns only consumer's own open demands | `futureOrders.test.ts` | Other users' demands absent |
| M4-I-07 | `DELETE /future-orders/:id` sets status to `cancelled` | `futureOrders.test.ts` | 200; `status: 'cancelled'` in DB |
| M4-I-08 | Publishing a listing triggers fanout and sends notification to matched consumer | `futureOrders.test.ts` | `PATCH /listings/:id/publish` → SendGrid mock called with consumer email |
| M4-I-09 | Publishing a listing does NOT notify consumer whose demand has expired | `futureOrders.test.ts` | SendGrid mock NOT called for expired demand |
| M4-I-10 | Publishing a listing does NOT notify consumer outside proximity | `futureOrders.test.ts` | SendGrid mock NOT called for out-of-range consumer |
| M4-I-11 | Matched future order record updated to `status: 'matched'` with `matched_listing_id` | `futureOrders.test.ts` | DB row reflects both fields after fanout |
| M4-I-12 | Fanout failure does not fail the publish endpoint (fire-and-forget) | `futureOrders.test.ts` | `PATCH /listings/:id/publish` returns 200 even when fanout throws |

### 7.5 Frontend Tests — Future Order Pages

| ID | Test Case | File | Pass Criteria |
|----|-----------|------|---------------|
| M4-F-01 | `FutureOrderPage` shows parsed intent confirmation card after parse call | `FutureOrderPage.test.tsx` | Product, quantity, date visible before save |
| M4-F-02 | `FutureOrderPage` confirm button calls `POST /future-orders` | `FutureOrderPage.test.tsx` | API mock called on confirm click |
| M4-F-03 | `FutureOrderPage` shows success state after saving | `FutureOrderPage.test.tsx` | "We'll notify you" message visible |
| M4-F-04 | `FutureOrdersListPage` shows correct status badge for each demand | `FutureOrdersListPage.test.tsx` | `open`, `matched`, `expired` badges rendered for respective items |

---

## 8. Milestone M5 — P1/P2 Feature Tests (FR-05, FR-06, FR-07, FR-09, FR-10)

### 8.1 Subscriptions (FR-05)

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| M5-I-01 | `POST /subscriptions` creates subscription with `status: 'active'` | Integration | 201; DB record created |
| M5-I-02 | `POST /subscriptions` as producer returns 403 | Integration | 403 |
| M5-I-03 | `POST /subscriptions` with invalid cadence value returns 400 | Integration | 400 |
| M5-I-04 | `GET /subscriptions` returns only the authenticated consumer's subscriptions | Integration | Other users' subscriptions absent |
| M5-U-01 | `SubscriptionModal` renders cadence options (weekly, biweekly, monthly) | Unit | All three options present |

### 8.2 Platform Fee Admin (FR-09, FR-10)

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| M5-I-05 | `GET /admin/config` returns current `fee_percent` | Integration | 200; `fee_percent` field present |
| M5-I-06 | `PATCH /admin/config` updates fee and new orders use new rate | Integration | Update to 10% → next order has `fee = subtotal * 0.10` |
| M5-I-07 | `PATCH /admin/config` as consumer returns 403 | Integration | 403 |
| M5-I-08 | `PATCH /admin/config` with `fee_percent > 100` returns 400 | Integration | 400 validation error |
| M5-I-09 | `PATCH /admin/config` with `fee_percent < 0` returns 400 | Integration | 400 validation error |
| M5-F-01 | `AdminConfigPage` fee form submits correct value and shows success toast | Unit | API mock called; success message visible |

### 8.3 Broker Flow (FR-07)

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| M5-I-10 | `POST /orders` with items from 3 different producers creates one order with 3 `order_items` | Integration | 201; `order_items.length === 3` |
| M5-I-11 | Platform fee calculated on combined subtotal (not per-producer) | Integration | Single `platform_fee_cents` on order |

---

## 9. Non-Functional Requirements Tests (NFR-01 to NFR-05)

### 9.1 NFR-01 — Shared API (Web + Mobile use same endpoints)

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| NFR01-01 | Every Playwright E2E test scenario can be replayed via `curl` against the same API | Manual | All API calls in Playwright network log return same data as direct curl calls |
| NFR01-02 | Mobile app `api/` client points to the same base URL as web app | Static review | Both `apps/web/src/api/client.ts` and `apps/mobile/src/api/client.ts` reference same `API_BASE_URL` env var |
| NFR01-03 | No endpoint exists in web API client that does not appear in `openapi.yaml` | CI lint | `openapi-validator` run against all routes registered in Express app |

### 9.2 NFR-02 — Location Privacy

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| NFR02-01 | `GET /listings` response never includes producer's exact `location_lat` / `location_lng` | Integration | Response fields for each listing contain only `location_zip` and `distance_miles` |
| NFR02-02 | `GET /users/:id` (public profile) does not expose precise coordinates | Integration | `location_lat`, `location_lng` absent from public profile response |
| NFR02-03 | `GET /listings/:id` shows only city/ZIP, not street-level address | Manual | Listing detail page shows "Las Cruces, NM" not "123 Main St" |
| NFR02-04 | Precision of returned coordinates is configurable via `platform_config` | Integration | Setting `location_precision = 'city'` causes listings to return city-centroid coordinates only |

### 9.3 NFR-03 — Security (see also §12 for dedicated security testing)

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| NFR03-01 | All `POST`, `PUT`, `PATCH`, `DELETE` endpoints return 401 without a valid JWT | Integration | Automated sweep of all write endpoints without auth header → all return 401 |
| NFR03-02 | All parameterized DB queries use placeholders, never string concatenation | Static review | No `query(\`SELECT ... ${userInput}\`)` patterns in `server/db/` |
| NFR03-03 | JWT secret is not committed to repository | CI | `git grep JWT_SECRET` returns only `.env.example` with placeholder value |
| NFR03-04 | API keys not committed to repository | CI | `git grep -E "sk_live_|sg\.[A-Za-z0-9]"` returns no matches |

### 9.4 NFR-04 — Accessibility (see also §11)

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| NFR04-01 | All interactive elements reachable via keyboard (Tab/Shift+Tab) | Playwright | No interactive element skipped in keyboard traversal of key pages |
| NFR04-02 | Color contrast ratio ≥ 4.5:1 for all text | axe-core | Zero contrast violations on all pages |
| NFR04-03 | All images have descriptive `alt` attributes | axe-core | Zero missing-alt violations |
| NFR04-04 | All form inputs have associated `<label>` elements | axe-core | Zero label violations |

### 9.5 NFR-05 — Disclaimers

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| NFR05-01 | Broker checkout page includes resale responsibility disclaimer text | Playwright | Page contains "broker's own responsibility" or equivalent text |
| NFR05-02 | Listing detail page for home-grower listing shows food safety notice | Playwright | Food safety disclaimer visible on producer_home listings |
| NFR05-03 | AI search results page shows AI limitation disclaimer | Unit | Disclaimer text rendered below explanation string |

---

## 10. UI & Visual Regression Tests

### 10.1 Key Pages Under Visual Test

Run with Playwright `screenshot()` + pixel-diff on every merge to `main`.

| Page | Route | Viewport |
|------|-------|----------|
| AI Search (empty state) | `/` | 1440×900, 375×812 |
| AI Search (results) | `/` + search submitted | 1440×900, 375×812 |
| Listing Detail | `/listings/:id` | 1440×900, 375×812 |
| Cart | `/cart` | 1440×900 |
| Checkout | `/checkout` | 1440×900 |
| Order Confirmation | `/orders/:id/confirmation` | 1440×900 |
| Future Order Form | `/future-orders/new` | 1440×900, 375×812 |
| Producer Dashboard | `/dashboard` | 1440×900 |

### 10.2 Visual Test Cases

| ID | Test Case | Pass Criteria |
|----|-----------|---------------|
| VIS-01 | `ListingCard` renders consistently across light and dark mode | Pixel diff < 0.1% |
| VIS-02 | Fee line item on `OrderConfirmationPage` is visually distinct from subtotal/total rows | Manual review — distinct typography or color |
| VIS-03 | AI search loading skeleton matches page layout (no layout shift on load) | Playwright `waitForLoadState` → no CLS detected |
| VIS-04 | Mobile web viewport (375px) has no horizontal overflow | Playwright mobile viewport → `document.documentElement.scrollWidth <= 375` |
| VIS-05 | Error states (empty search, failed payment) have clearly visible error messages | axe-core + visual check |

---

## 11. Accessibility Testing (NFR-04)

### 11.1 Automated axe-core Checks (run in Playwright for each key page)

```typescript
// Example: embedded in each E2E test
const violations = await new AxeBuilder({ page }).analyze();
expect(violations.violations).toHaveLength(0);
```

Pages covered: Login, Register, AI Search, Listing Detail, Cart, Checkout, Order Confirmation, Future Order, Producer Dashboard, Admin Config.

### 11.2 Manual Keyboard Navigation Checklist

| Check | Steps | Pass Criteria |
|-------|-------|---------------|
| KBD-01 | Tab through AI Search page | Search input → submit button → result cards → "Add to Cart" buttons all focusable in logical order |
| KBD-02 | Submit AI search with Enter key | Enter in search field triggers search |
| KBD-03 | Complete checkout with keyboard only | All Stripe `PaymentElement` fields + submit button reachable without mouse |
| KBD-04 | Register form navigable without mouse | All fields + role selector + submit accessible |
| KBD-05 | Focus trap in modal dialogs (subscription modal) | Tab does not escape modal while open |

### 11.3 Screen Reader Spot Check (manual)

Test with VoiceOver (macOS) or NVDA (Windows):
- AI search results: each `ListingCard` announces product name, price, and distance.
- Order Confirmation: fee breakdown announced clearly (not just numbers).
- Future Order confirmation: parsed intent read back before confirm button.

---

## 12. Security Testing (NFR-03)

### 12.1 Authentication & Authorization

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| SEC-01 | IDOR: Consumer A cannot view Consumer B's orders via `GET /orders/:id` | Integration | 403 |
| SEC-02 | IDOR: Consumer A cannot cancel Consumer B's future order | Integration | 403 |
| SEC-03 | IDOR: Producer A cannot edit Producer B's listing | Integration | 403 |
| SEC-04 | Privilege escalation: Consumer cannot reach `PATCH /admin/config` | Integration | 403 |
| SEC-05 | Token replay after logout fails | Integration | Invalidated token → 401 |
| SEC-06 | Expired JWT (1 second past expiry) is rejected | Integration | 401; `TOKEN_EXPIRED` |

### 12.2 Input Validation & Injection

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| SEC-07 | SQL injection in `GET /listings?q=` parameter | Integration | `?q=' OR 1=1--` → returns normal filtered results, not all rows |
| SEC-08 | XSS payload in listing title stored and retrieved safely | Integration | `<script>alert(1)</script>` stored as escaped string; React renders as text, not HTML |
| SEC-09 | XSS payload in AI search query not reflected in raw HTML | Integration | `<img src=x onerror=alert(1)>` in query → API response encodes the string |
| SEC-10 | Extremely long input (10,000 chars) in AI search query is rejected | Integration | 400; `QUERY_TOO_LONG` |
| SEC-11 | Path traversal in listing image filename rejected | Integration | `../../../etc/passwd` filename → 400 |

### 12.3 Rate Limiting

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| SEC-12 | Auth endpoint rate limit (10 req/min/IP) enforced | Integration | 11th request within 60s → 429 |
| SEC-13 | AI search rate limit (20 req/user/hour) enforced | Integration | 21st request within 1h → 429 |
| SEC-14 | Rate limit returns `Retry-After` header | Integration | `Retry-After` header present on 429 response |

### 12.4 Secrets & Sensitive Data

| ID | Test Case | Type | Pass Criteria |
|----|-----------|------|---------------|
| SEC-15 | Password hash never returned in any API response | Integration | `password_hash` key absent from all user objects in responses |
| SEC-16 | Stripe `payment_ref` not exposed in `GET /orders` list endpoint | Integration | `payment_ref` absent from order list response body |
| SEC-17 | `JWT_SECRET` not present in any committed file (except `.env.example` placeholder) | CI git scan | `git grep -r "JWT_SECRET" --include="*.ts" --include="*.js"` returns no results with real values |

---

## 13. Performance & Load Testing

### 13.1 Tool: k6

Run against staging environment before demo day.

### 13.2 API Throughput Benchmarks

| ID | Scenario | Load | Target P95 Latency | Target Error Rate |
|----|----------|------|--------------------|-------------------|
| PERF-01 | `GET /listings?q=tomato&zip=88001` | 50 VUs, 2 min | < 200ms | < 0.1% |
| PERF-02 | `POST /auth/login` | 20 VUs, 1 min | < 300ms | < 0.1% |
| PERF-03 | `POST /orders` (full order creation) | 20 VUs, 1 min | < 500ms | < 0.1% |

### 13.3 AI Endpoint Latency

| ID | Scenario | Expectation | Pass Criteria |
|----|----------|-------------|---------------|
| PERF-04 | `POST /ai/search` single call latency (real Claude API) | Claude function-call round trip | P95 < 4s |
| PERF-05 | `POST /ai/search` with Redis prompt cache hit | Prompt already cached | P95 < 3s |
| PERF-06 | `POST /ai/parse-demand` single call latency | Claude function-call round trip | P95 < 4s |

### 13.4 Database Query Performance

| ID | Check | Pass Criteria |
|----|-------|---------------|
| PERF-07 | `EXPLAIN ANALYZE` on `/listings` search query with ZIP + keyword filter | No sequential scan on `listings` table; uses index |
| PERF-08 | `EXPLAIN ANALYZE` on future order match query triggered by listing publish | Uses index on `future_orders.status`; query < 10ms on 10,000 row dataset |

---

## 14. Demo Scenario Acceptance Tests

These are the final gate before the hackathon presentation. Both scenarios must pass with zero errors.

### 14.1 Demo Scenario 1 — AI Search → Checkout (End-to-End)

**Setup:** `demo/seed-data.sql` loaded; producer account `demo-producer@test.com`, consumer account `demo-consumer@test.com`.

| Step | Action | Expected Result |
|------|--------|-----------------|
| DS1-01 | Navigate to `/` as unauthenticated user | AI search bar visible; no console errors |
| DS1-02 | Log in as `demo-consumer@test.com` | Redirect to `/`; user avatar visible in nav |
| DS1-03 | Type "Find me some zucchini" in search bar, press Enter | Loading skeleton appears; API call to `POST /ai/search` fires |
| DS1-04 | Results appear | ≥1 `ListingCard` visible; explanation text rendered above cards; no console errors |
| DS1-05 | Click "Add to Cart" on zucchini listing | Cart icon updates count; toast notification appears |
| DS1-06 | Navigate to `/cart` | Listing visible; subtotal shown; estimated fee % shown as line item |
| DS1-07 | Click "Proceed to Checkout" | Redirect to `/checkout`; Stripe `PaymentElement` renders |
| DS1-08 | Enter Stripe test card `4242 4242 4242 4242`, exp `12/34`, CVC `123`, submit | Payment processing spinner; no errors |
| DS1-09 | Payment completes | Redirect to `/orders/:id/confirmation` |
| DS1-10 | Order confirmation page | Subtotal, platform fee (e.g., 7%), and total all visible as separate line items |
| DS1-11 | Check DB | `orders` row has `status: 'paid'`; `listings.quantity_available` decremented |
| **Total time** | | **< 90 seconds** |

### 14.2 Demo Scenario 2 — Future Order → Notification (End-to-End)

**Setup:** Demo seed loaded; SendGrid configured to `mailtrap.io` inbox.

| Step | Action | Expected Result |
|------|--------|-----------------|
| DS2-01 | Log in as `demo-consumer@test.com` | Authenticated |
| DS2-02 | Navigate to `/future-orders/new` | Future Order form visible |
| DS2-03 | Type "I need 10 oranges within the next 2 days" and submit | Parsed intent card shows: product "oranges", qty 10, expiry ~48h |
| DS2-04 | Click "Confirm & Save" | 201 response; "We'll notify you" success state |
| DS2-05 | Check DB | `future_orders` row with `status: 'open'` |
| DS2-06 | Switch to `demo-producer@test.com` account | Producer dashboard visible |
| DS2-07 | Create listing: "Navel Oranges, $2/lb, ZIP 88001, category: fruit" | 201 created |
| DS2-08 | Publish listing (`PATCH /listings/:id/publish`) | 200; `status: 'active'` |
| DS2-09 | Check mailtrap.io inbox for consumer email | Email received with subject containing "oranges" and link to listing |
| DS2-10 | Check DB | `future_orders` row updated to `status: 'matched'`, `matched_listing_id` set |
| **Total time** | | **< 60 seconds** |

---

## 15. Test Coverage Targets

| Area | Tool | Minimum Coverage |
|------|------|-----------------|
| Backend services (`server/services/`) | Jest `--coverage` | **90% line coverage** |
| Backend routes (`server/routes/`) | Jest `--coverage` | **85% line coverage** |
| Frontend components (`apps/web/src/`) | Vitest `--coverage` | **75% line coverage** |
| Frontend stores (`apps/web/src/stores/`) | Vitest `--coverage` | **90% line coverage** |
| Critical paths (fee calc, fanout, auth) | Manual review | **100% branch coverage** |

### Coverage Enforcement in CI

```json
// jest.config.ts
coverageThreshold: {
  "server/services/feeService.ts": { lines: 100, branches: 100 },
  "server/services/aiSearchService.ts": { lines: 90 },
  "server/jobs/listingPublishFanout.ts": { lines: 90, branches: 90 },
  global: { lines: 80, branches: 75 }
}
```

---

## 16. Defect Triage & Severity Levels

| Severity | Definition | Resolution SLA (Hackathon) |
|----------|------------|---------------------------|
| **P0 — Blocker** | Demo scenario cannot be completed; data loss; auth bypass | Fix before any other work; do not present without resolution |
| **P1 — Critical** | Core feature broken (AI search returns 500, payment fails, notifications not sent) | Fix within current milestone; block milestone exit |
| **P2 — Major** | Feature works but with wrong data (fee calculation off, wrong distance shown) | Fix before demo day |
| **P3 — Minor** | Visual glitch, non-critical validation missing, copy error | Fix in M5 polish; acceptable to defer post-demo |
| **P4 — Trivial** | Cosmetic issues, low-impact edge cases | Log for post-hackathon; do not block demo |

### Defect Template

```
Title: [P0/P1/P2/P3] Short description
Milestone: M_
FR/NFR: FR-XX or NFR-XX
Steps to reproduce:
  1.
  2.
Expected: 
Actual: 
Environment: local / CI / staging
```

---

*End of Test Plan*
