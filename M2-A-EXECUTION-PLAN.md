# M2-A Execution Plan — Delivery/Pickup UX + Landing Page

## Overview
Three additive features on top of M2:
1. **Producer delivery toggle** — "Ready to deliver" checkbox on CreateListing; if unchecked, require pickup date/time/location.
2. **Consumer checkout flow** — CheckoutPage shows delivery address field (producer delivers) or pickup info (producer sets pickup).
3. **Public landing page** — Value-proposition page before auth, with producer/consumer skip paths.

## Entry Criteria
- M2 fully working: listings CRUD, ZIP/radius search, producer dashboard
- DB migrations 001 and 002 applied
- Auth (JWT) working for producer and consumer roles

---

## Phase A — DB & Shared Types (~20 min)

### A1 — DB Migration 003
**File:** `server/src/db/migrations/003_add_delivery_fields.sql`

Add four columns to `listings`:
- `ready_to_deliver BOOLEAN NOT NULL DEFAULT TRUE`
- `pickup_date DATE` (nullable)
- `pickup_time TIME` (nullable)
- `pickup_location TEXT` (nullable)

Add `delivery_address` to `Order` interface (frontend type only — physical orders column is M3).

Apply: `psql $DATABASE_URL -f server/src/db/migrations/003_add_delivery_fields.sql`

### A2 — Shared Types Update
**File:** `packages/shared-types/src/index.ts`

Listing gets:
```ts
readyToDeliver: boolean;
pickupDate?: string;    // ISO date "YYYY-MM-DD"
pickupTime?: string;    // "HH:MM"
pickupLocation?: string;
```

Order gets:
```ts
deliveryAddress?: string;
```

CreateOrderRequest gets:
```ts
deliveryAddress?: string;
```

---

## Phase B — Backend (~1 hour)

### B1 — listingService.ts
Extend `ListingRow` interface with new fields. Update SELECT query to include `ready_to_deliver`, `pickup_date`, `pickup_time`, `pickup_location`.

### B2 — listings.ts POST route
Add validators:
```
body('ready_to_deliver').optional().isBoolean()
body('pickup_date').optional().isISO8601()
body('pickup_time').optional().matches(/^\d{2}:\d{2}$/)
body('pickup_location').optional().trim().isLength({ max: 300 })
```
After validation pass, cross-field check: if `ready_to_deliver=false`, reject if any of `pickup_date`, `pickup_time`, `pickup_location` is missing.

Expand INSERT to include four new columns.

### B3 — listings.ts PUT route
Same validators + cross-field check as POST. Expand COALESCE UPDATE to include new columns.

---

## Phase C — Frontend (~2.5 hours)

### C1 — CreateListingPage.tsx
- Extend Zod schema with `ready_to_deliver` (boolean, default true) + conditional pickup fields via `superRefine`.
- Add a visible toggle/checkbox: **"Ready to deliver"** (checked by default).
- When unchecked, animate-in three new fields: Pickup Date (date input), Pickup Time (time input), Pickup Location (text input, max 300 chars).
- On submit: include all four new fields in FormData.

### C2 — ListingCard.tsx
- Add props: `ready_to_deliver`, `pickup_date?`, `pickup_time?`, `pickup_location?`.
- Render a small pill badge: green "Delivers" or amber "Pickup" under the price line.
- Pass through new props from ListingsPage and ProducerDashboard.

### C3 — LandingPage.tsx (new)
Public page at `/`. No auth required.

Layout:
```
[Navbar] — Community Garden logo | Sign In button
[Hero] — headline + subheadline + two CTAs
[Two-column section] — For Producers | For Consumers
[Footer] — Skip / Sign In link
```

CTAs:
- "Join as Producer" → `/register` (role pre-selected via query param handled in RegisterPage)
- "Join as Consumer" → `/register`
- "Skip — Sign In" → `/login`

Value props for **Producers**: Reach local buyers · No middleman fees · Set your own prices · Flexible delivery or pickup.

Value props for **Consumers**: Fresh from neighbors · Know your grower · Pay fair prices · Find exactly what you need.

### C4 — CheckoutPage.tsx (new)
Protected route at `/checkout/:listingId`.

Behavior:
1. Fetch `GET /listings/:id` on mount.
2. Show listing summary: image, title, category, price, producer name (if available).
3. Quantity selector (1 to `quantity_available`).
4. **If `ready_to_deliver = true`**: Show "Delivery Address" input (required text field).
5. **If `ready_to_deliver = false`**: Show read-only pickup info card: Pickup Date, Pickup Time, Pickup Location.
6. "Place Order" button — stub: navigates to `/orders` (full Stripe integration in M3). Button disabled until required fields filled.

### C5 — App.tsx
- Replace `/` placeholder with `<LandingPage />` (public, no ProtectedRoute).
- Add `/checkout/:listingId` → `<ProtectedRoute><CheckoutPage /></ProtectedRoute>`.

---

## Test Plan

### Backend Tests (`server/src/__tests__/listings.test.ts`)

| Test | Assertion |
|------|-----------|
| POST /listings with `ready_to_deliver=true` and no pickup fields | 201, `ready_to_deliver=true`, pickup fields null |
| POST /listings with `ready_to_deliver=false` + all pickup fields | 201, pickup fields stored correctly |
| POST /listings with `ready_to_deliver=false` + missing pickup_location | 422 VALIDATION_ERROR |
| POST /listings with `ready_to_deliver=false` + missing pickup_date | 422 VALIDATION_ERROR |
| POST /listings with `ready_to_deliver=false` + missing pickup_time | 422 VALIDATION_ERROR |
| PUT /listings/:id update pickup_location | 200, updated field reflected |
| GET /listings returns `ready_to_deliver` field | Field present in all results |
| GET /listings/:id returns all delivery fields | Single listing includes all four new fields |

### Frontend Tests (`apps/web/src/__tests__/`)

#### CreateListingPage.test.tsx
- Renders without "pickup fields" visible by default (ready_to_deliver checked).
- Unchecking "Ready to deliver" shows pickup date, time, location fields.
- Re-checking hides them.
- Submitting with ready_to_deliver=false + missing pickup_location shows Zod error.
- Submitting with all fields calls API with correct FormData.

#### LandingPage.test.tsx
- Renders "Join as Producer" and "Join as Consumer" CTAs.
- "Skip" link points to `/login`.
- "Sign In" navbar link points to `/login`.
- Producer value props section visible.
- Consumer value props section visible.

#### CheckoutPage.test.tsx
- Shows "Delivery Address" input when listing has `ready_to_deliver=true`.
- Shows pickup info (date, time, location) when `ready_to_deliver=false`.
- "Place Order" button disabled when delivery address empty (deliver case).
- "Place Order" button enabled immediately (pickup case, no extra input needed).
- Shows loading skeleton while fetching listing.
- Shows error state if listing fetch fails.

---

## Integration Checklist

- [ ] Migration 003 applied, `\d listings` shows four new columns
- [ ] Producer creates listing with "Ready to deliver" unchecked → pickup fields stored in DB
- [ ] Consumer browses → ListingCard shows green "Delivers" or amber "Pickup" badge
- [ ] Consumer navigates to `/checkout/:id` for a deliver listing → sees delivery address field
- [ ] Consumer navigates to `/checkout/:id` for a pickup listing → sees pickup info, no address field
- [ ] Anonymous user visits `/` → sees LandingPage, not redirected to login
- [ ] "Join as Producer" CTA → /register page
- [ ] "Skip" → /login page

---

## File Change Summary

| File | Change |
|------|--------|
| `server/src/db/migrations/003_add_delivery_fields.sql` | **New** — adds 4 columns to listings |
| `packages/shared-types/src/index.ts` | Extend Listing + Order types |
| `server/src/services/listingService.ts` | ListingRow + SELECT query updated |
| `server/src/routes/listings.ts` | POST + PUT validators + INSERT/UPDATE expanded |
| `apps/web/src/pages/CreateListingPage.tsx` | Add delivery toggle + conditional pickup fields |
| `apps/web/src/components/ListingCard.tsx` | Add delivery/pickup badge |
| `apps/web/src/pages/LandingPage.tsx` | **New** — public landing page |
| `apps/web/src/pages/CheckoutPage.tsx` | **New** — delivery vs pickup checkout |
| `apps/web/src/App.tsx` | Add landing + checkout routes |

---

## Effort Estimate

| Track | Time |
|-------|------|
| DB + Types | 20 min |
| Backend routes | 40 min |
| CreateListingPage | 30 min |
| ListingCard badge | 15 min |
| LandingPage | 45 min |
| CheckoutPage | 45 min |
| App.tsx routing | 10 min |
| Tests | 45 min |
| **Total** | **~4 hours** |
