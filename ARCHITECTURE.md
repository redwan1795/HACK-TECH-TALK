# Community Garden — Project Architecture

## Overview

Community Garden is a marketplace platform connecting home growers, small farmers, consumers, brokers, mentors, and lenders around locally grown produce. The platform runs as a web app and a mobile app sharing a single backend API.

**Repository:** https://github.com/redwan1795/HACK-TECH-TALK  
**Stage:** Planning / Hackathon

---

## Table of Contents

1. [System Context](#1-system-context)
2. [Stakeholders & Roles](#2-stakeholders--roles)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Data Model](#6-data-model)
7. [API Design](#7-api-design)
8. [Core Feature Flows](#8-core-feature-flows)
9. [Integrations](#9-integrations)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

## 1. System Context

```
┌─────────────────────────────────────────────────────────┐
│                    Community Garden                      │
│                                                         │
│   Web App (React / Vue)   Mobile App (React Native)     │
│           │                        │                    │
│           └──────────┬─────────────┘                    │
│                      │                                  │
│              REST / GraphQL API                         │
│                      │                                  │
│    ┌─────────────────┼──────────────────┐               │
│    │                 │                  │               │
│  Auth            Database            Storage            │
│  Service         (PostgreSQL)        (S3 / CDN)         │
│                                                         │
└─────────────────────────────────────────────────────────┘
         │                    │                  │
    Payment API           Maps API          LLM API
    (Stripe/Square)   (Google/Mapbox)    (Claude/OpenAI)
```

---

## 2. Stakeholders & Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Platform Operator** | Manages fee configuration, feature flags, admin dashboard | Full admin access |
| **Producer — Home Grower** | Unlicensed; limited to personal surplus | Create listings, manage orders |
| **Producer — Small Farmer** | Licensed seller | Create listings, manage subscriptions, access mentor |
| **Consumer — Individual** | Buys, exchanges, subscribes; uses AI search and Future Orders | Browse via AI prompt, purchase, barter, subscribe, post demand signals |
| **Consumer — Broker** | Aggregates wholesale orders for resale | Bulk purchasing, multi-producer basket |
| **Mentor** | Advises farmers; compensated on success milestones | View mentee data, track milestones |
| **Lender (Third-Party)** | External financial service accessed via API link | Read-only referral integration |

---

## 3. High-Level Architecture

### Deployment Model

```
                          ┌──────────────┐
                          │   CDN / Edge │
                          └──────┬───────┘
                                 │ static assets
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
   ┌──────┴──────┐        ┌──────┴──────┐       ┌──────┴──────┐
   │  Web Client  │        │ Mobile App  │       │ Admin Panel │
   │ (Browser)    │        │ (iOS/Android│       │  (Operator) │
   └──────┬───────┘        └──────┬──────┘       └──────┬──────┘
          │                       │                      │
          └───────────────────────┼──────────────────────┘
                                  │ HTTPS
                         ┌────────┴────────┐
                         │   API Gateway    │
                         │  (rate limiting, │
                         │   auth, routing) │
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼────────────────────┐
              │                   │                    │
       ┌──────┴──────┐   ┌────────┴───────┐  ┌────────┴───────┐
       │  Core API    │   │   AI Service   │  │  Notification  │
       │  (Express /  │   │  (LLM proxy,   │  │  Service       │
       │   FastAPI)   │   │  search intent,│  │  (email/push,  │
       │              │   │  future order  │  │  future order  │
       │              │   │  matching)     │  │  alerts)       │
       └──────┬───────┘   └────────────────┘  └────────────────┘
              │
     ┌────────┼──────────┐
     │        │          │
 ┌───┴───┐ ┌──┴──┐ ┌─────┴─────┐
 │Postgres│ │Redis│ │File Store │
 │       │ │Cache│ │(S3/local) │
 └───────┘ └─────┘ └───────────┘
```

### Key Architectural Decisions

- **Contract-first API** — OpenAPI spec is written before any implementation so web and mobile teams can develop in parallel against mock servers.
- **Shared backend** — A single REST API serves both web and mobile; no platform-specific backends.
- **Role-scoped auth** — JWT tokens carry role claims; middleware enforces permissions per endpoint.
- **Pluggable integrations** — Payment, maps, and AI services are behind thin adapter interfaces so providers can be swapped without touching business logic.
- **AI-first search** — Natural-language prompt is the primary product discovery interface; the LLM extracts structured intent which is passed to the standard listing search pipeline. Keyword search is a fallback.
- **Future Orders as event-driven demand signals** — Open demand records are stored in the database. A listing-published event (triggered on `POST /listings`) fan-outs a matching job; matched consumers are notified in real time via the Notification Service.

---

## 4. Frontend Architecture

### Web Application

```
src/
├── app/               # Routing, layouts, global providers
├── features/          # Feature-sliced modules (see below)
│   ├── auth/
│   ├── listings/
│   ├── search/            # AI prompt search bar (primary), keyword fallback
│   ├── future-orders/     # Post demand signal, view open orders, notifications
│   ├── checkout/
│   ├── subscriptions/
│   ├── exchange/
│   ├── broker/
│   └── admin/
├── shared/
│   ├── components/    # Design system primitives
│   ├── hooks/
│   ├── api/           # Generated client from OpenAPI spec
│   └── utils/
└── main.tsx
```

**Recommended stack:** React + TypeScript, Vite, TanStack Query for server state, Zustand for local state, Tailwind CSS.

### Mobile Application

Mirrors the web feature structure. Cross-platform via **React Native** (recommended for code-sharing with the web layer).

```
src/
├── navigation/        # Stack and tab navigators
├── features/          # Same slice names as web
├── shared/
│   ├── components/
│   ├── hooks/
│   └── api/           # Same generated client
└── App.tsx
```

---

## 5. Backend Architecture

### Directory Structure

```
server/
├── api/
│   ├── routes/        # Route handlers grouped by domain
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── listings.ts
│   │   ├── orders.ts
│   │   ├── subscriptions.ts
│   │   ├── exchanges.ts
│   │   ├── future-orders.ts
│   │   └── admin.ts
│   └── middlewares/   # Auth, rate limiting, error handling
├── services/          # Business logic (no HTTP dependencies)
│   ├── AuthService.ts
│   ├── ListingService.ts
│   ├── OrderService.ts
│   ├── FeeService.ts              # Platform fee calculation
│   ├── LocationService.ts         # Proximity / Haversine matching
│   ├── AIService.ts               # LLM intent extraction + search
│   ├── FutureOrderService.ts      # Demand signal storage + matching
│   └── NotificationService.ts
├── integrations/      # Thin adapters for external APIs
│   ├── payment/
│   ├── maps/
│   └── llm/
├── db/
│   ├── schema.sql
│   ├── migrations/
│   └── repositories/  # Data access layer
└── config/
```

**Recommended stack:** Node.js + TypeScript with Express or Fastify, or Python with FastAPI.

---

## 6. Data Model

### Entity Relationship (simplified)

```
users ──< listings
users ──< orders
users ──< subscriptions
listings ──< order_items
orders >── platform_fees
listings ──< exchanges
users ──< future_orders          (demand signals)
future_orders >──< listings      (matched via event fan-out)
users >── mentor_relationships >── users
```

### Core Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | text UNIQUE | |
| password_hash | text | |
| role | enum | producer_home, producer_farmer, consumer, broker, mentor, operator |
| location_zip | text | |
| location_lat | float | Precision configurable for privacy |
| location_lng | float | |
| licensed | boolean | Producers only |
| created_at | timestamptz | |

#### `listings`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| producer_id | UUID FK → users | |
| title | text | |
| description | text | |
| category | enum | fruit, vegetable, flower, egg, other |
| price_cents | int | Null = exchange only |
| quantity_available | int | |
| exchange_for | text | Barter description, nullable |
| location_zip | text | May differ from user's ZIP |
| images | text[] | URLs |
| is_available | boolean | |
| created_at | timestamptz | |

#### `orders`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| consumer_id | UUID FK → users | |
| status | enum | pending, paid, fulfilled, cancelled |
| subtotal_cents | int | |
| platform_fee_cents | int | 5–10% of subtotal |
| total_cents | int | |
| payment_ref | text | External payment ID |
| created_at | timestamptz | |

#### `order_items`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| order_id | UUID FK → orders | |
| listing_id | UUID FK → listings | |
| quantity | int | |
| unit_price_cents | int | Snapshot at time of order |

#### `subscriptions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| consumer_id | UUID FK → users | |
| listing_id | UUID FK → listings | |
| cadence | enum | weekly, biweekly, monthly |
| status | enum | active, paused, cancelled |
| next_billing_at | timestamptz | |

#### `exchanges`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| initiator_id | UUID FK → users | |
| listing_id | UUID FK → listings | |
| offered_item | text | |
| status | enum | pending, accepted, declined |

#### `future_orders`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| consumer_id | UUID FK → users | |
| product_query | text | Free-text description, e.g. "oranges" |
| category | enum | Derived from LLM parsing of product_query |
| quantity_needed | int | |
| proximity_miles | int | Max distance from consumer's location |
| expires_at | timestamptz | Deadline — demand signal auto-closes after this |
| status | enum | open, fulfilled, expired, cancelled |
| created_at | timestamptz | |

#### `platform_config`
| Column | Type | Notes |
|--------|------|-------|
| key | text PK | e.g. `fee_percent` |
| value | text | |
| updated_at | timestamptz | |

---

## 7. API Design

### Authentication

All write endpoints require a `Bearer <JWT>` header. The JWT payload carries:

```json
{ "sub": "<user_id>", "role": "consumer", "iat": 0, "exp": 0 }
```

### Endpoint Groups

| Group | Base Path | Notable Endpoints |
|-------|-----------|-------------------|
| Auth | `/api/v1/auth` | `POST /register`, `POST /login`, `POST /refresh` |
| Users | `/api/v1/users` | `GET /me`, `PATCH /me` |
| Listings | `/api/v1/listings` | `GET /` (search+filter), `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Orders | `/api/v1/orders` | `POST /`, `GET /:id`, `PATCH /:id/status` |
| Subscriptions | `/api/v1/subscriptions` | `POST /`, `GET /`, `PATCH /:id`, `DELETE /:id` |
| Exchanges | `/api/v1/exchanges` | `POST /`, `GET /:id`, `PATCH /:id/status` |
| Future Orders | `/api/v1/future-orders` | `POST /` (create demand signal), `GET /` (my open demands), `DELETE /:id` (cancel) |
| Admin | `/api/v1/admin` | `GET /config`, `PATCH /config`, `GET /fees` |
| AI | `/api/v1/ai` | `POST /search` (freetext → listings), `POST /parse-demand` (freetext → structured future order) |

### Search / Filter Parameters (`GET /api/v1/listings`)

```
?q=tomatoes          # keyword search
&zip=88001           # location anchor
&radius_miles=25     # proximity filter
&category=vegetable
&max_price_cents=500
&allow_exchange=true
&page=1&limit=20
```

### Platform Fee Calculation

Fee is computed server-side only, never trusted from the client:

```
fee_cents = floor(subtotal_cents * fee_percent / 100)
total_cents = subtotal_cents + fee_cents
```

`fee_percent` is read from `platform_config` at order creation time and stored on the order record for auditability.

---

## 8. Core Feature Flows

### 8.1 Producer Posts a Listing (FR-01, FR-02)

```
Producer → POST /auth/register (role=producer_farmer)
         → POST /auth/login → JWT
         → POST /listings (title, category, price, images, zip)
         ← 201 { listing_id }
```

### 8.2 Consumer Finds & Buys (FR-03, FR-04)

```
Consumer → POST /ai/search { prompt: "Find me some zucchini", zip: "88001", radius_miles: 25 }
         ← { listings: [{ listing_id, producer, price, distance_miles, ... }], explanation: "..." }
         → POST /orders { items: [{ listing_id, quantity }] }
         ← { order_id, subtotal, fee, total, payment_intent_client_secret }
         → [frontend completes Stripe payment using client secret]
         → PATCH /orders/:id/status { status: "paid" }
```

The AI search call is the first step; consumers do not need to touch a filter form.

### 8.3 AI Natural-Language Search (FR-08)

```
Consumer → POST /ai/search
           { prompt: "Find me some zucchini", zip: "88001", radius_miles: 25 }
         ← { listings: [...], explanation: "Showing zucchini listings within 25 miles of 88001." }
```

The AI service:
1. Sends the prompt to the LLM with a structured function-call schema.
2. LLM returns parsed intent: `{ categories: ["vegetable"], keywords: ["zucchini"], exchange: false }`.
3. Service executes the standard listing search using extracted parameters + consumer's location.
4. Returns results ranked by proximity, with a short human-readable explanation.
5. If the LLM is unavailable, falls back to a plain keyword search against the `title` and `description` fields.

**Rate limiting:** 20 requests / user / hour on the AI endpoint.

### 8.4 Subscription Setup (FR-05)

```
Consumer → POST /subscriptions { listing_id, cadence: "weekly" }
         ← { subscription_id, next_billing_at }
```

Recurring billing is handled by a background job that triggers at `next_billing_at`, creates an order, and charges the saved payment method.

### 8.5 Broker Aggregate Order (FR-07)

Brokers use the same checkout flow but can add items from multiple listings in a single order. The frontend shows a running basket; the backend treats it as one order with multiple `order_items`.

### 8.6 Future Order — Consumer Posts Demand Signal (FR-11)

```
Consumer → POST /ai/parse-demand
           { prompt: "I need 10 oranges within the next 2 days", zip: "88001" }
         ← { category: "fruit", keywords: ["orange"], quantity: 10,
             expires_at: "<now + 48h>", proximity_miles: 25 }

Consumer → POST /future-orders
           { product_query: "oranges", category: "fruit", quantity_needed: 10,
             proximity_miles: 25, expires_at: "<now + 48h>" }
         ← { future_order_id, status: "open" }
```

The consumer can also skip the AI parse step and fill the form directly.

### 8.7 Future Order — Producer Triggers Notification (FR-11)

```
Producer → POST /listings { category: "fruit", title: "Fresh Navel Oranges", ... }
         ← 201 { listing_id }

[Server: ListingPublishedEvent fired]
[FutureOrderService: queries open future_orders where
  category matches AND expires_at > now AND
  haversine(listing.lat, listing.lng, consumer.lat, consumer.lng) ≤ proximity_miles]
[For each matched future_order:]
  NotificationService → email / push to consumer:
    "A producer near you just listed oranges — your demand signal matches!"
    [link to listing]
```

The matching query runs synchronously on listing creation for MVP (acceptable at hackathon scale). At production scale this would move to an async job queue.

---

## 9. Integrations

### Payment (Stripe recommended)

| Usage | Stripe API |
|-------|-----------|
| One-time purchase | `PaymentIntent` |
| Subscriptions | `Subscription` + `Customer` |
| Platform fee | `application_fee_amount` on connect accounts |

All payment keys stored as environment variables; sandbox keys used for development and demo.

### Maps / Geolocation

- ZIP code → lat/lng lookup via a free geocoding API (e.g., Zippopotam.us) for MVP.
- Distance calculation: Haversine formula server-side (no paid API required for MVP).
- Upgrade path: Google Maps Platform or Mapbox for map rendering in the UI.

### LLM / AI (FR-08, FR-11)

- **Provider:** Claude API (Anthropic) recommended; OpenAI is drop-in alternative.
- **Two call types:**
  - `POST /ai/search` — free-text product search → extracts `{ categories, keywords, quantity, exchange }` → runs listing search → returns ranked results + explanation.
  - `POST /ai/parse-demand` — free-text future need → extracts `{ category, keywords, quantity, expires_at, proximity_miles }` → returns structured object for the consumer to confirm before saving.
- **Function-calling pattern:** both calls use LLM tool/function calling so the model is forced to return structured JSON; the response is never parsed as free text.
- **Cost control:** Prompt caching on the shared system prompt (product categories, schema descriptions); user prompts are short.
- **Fallback:** If LLM is unavailable, fall back to plain keyword search (`q=` parameter) for search; show a manual form for future order creation.

### Notifications

Email via SendGrid or AWS SES, and/or push via FCM/APNs (mobile), for:
- Order confirmation
- Subscription billing receipts
- Exchange status updates
- **Future Order match alert** — triggered when a new listing satisfies an open demand signal within proximity and time window

---

## 10. Non-Functional Requirements

| ID | Requirement | Implementation Approach |
|----|-------------|------------------------|
| NFR-01 | Web + mobile share same APIs | Contract-first OpenAPI spec; no platform forks |
| NFR-02 | Location privacy | Store precise coordinates server-side; surface only city/ZIP to other users; configurable precision |
| NFR-03 | Security | JWT auth on all writes; rate limiting on AI and auth endpoints; parameterized queries only |
| NFR-04 | Accessibility | Semantic HTML, ARIA labels, minimum contrast 4.5:1, keyboard navigation on all interactive elements |
| NFR-05 | Disclaimers | Broker resale responsibility notice at checkout; food safety disclaimer on listing pages; AI limitation note on recommendation results |

---

## 11. Implementation Roadmap

### Phase 0 — Foundation (Day 1 morning)
- [ ] Initialize monorepo (e.g., `apps/web`, `apps/mobile`, `server`)
- [ ] Write OpenAPI spec for P0 endpoints (listings, auth, AI search, future-orders)
- [ ] Set up database with initial migrations (include `future_orders` table)
- [ ] Configure auth middleware and JWT issuance

### Phase 1 — P0 MVP (Day 1)
- [ ] FR-01: Registration / login with role selection
- [ ] FR-02: Producer listing creation with photo upload
- [ ] FR-08: `POST /ai/search` — AI natural-language search endpoint (primary search UI)
- [ ] FR-03: Fallback keyword browse with ZIP + category filter
- [ ] FR-04: Consumer checkout with mock Stripe payment and fee line item

### Phase 2 — P1 Features (Day 2 morning)
- [ ] FR-11: Future Order — `POST /ai/parse-demand` + `POST /future-orders` + listing-published matching + notification dispatch
- [ ] FR-05: Subscription intent and recurring billing placeholder
- [ ] FR-07: Broker multi-producer basket view
- [ ] FR-09: Platform fee configuration in admin dashboard

### Phase 3 — P2 / Polish (Day 2 afternoon)
- [ ] FR-06: Exchange / barter listing and acceptance flow
- [ ] FR-10: Admin config panel (fee %, feature flags)
- [ ] Mobile UI polish
- [ ] Accessibility audit pass
- [ ] Demo script rehearsal

### Phase 4 — Stretch (if time permits)
- [ ] FR-12: Financing flow (lender link, mentor milestone tracking)
- [ ] Push notifications (FCM/APNs) in addition to email for future order alerts
- [ ] Map view for listings

---

## Hackathon Demo Script

1. **Producer** registers as a small farmer, creates a zucchini listing ($2.00/lb) with a photo.
2. **Consumer** types **"Find me some zucchini"** into the AI search bar — no filters, no form. The app calls `POST /ai/search`, extracts intent, and returns the nearby listing with distance and a short explanation.
3. **Consumer** adds the listing to cart, proceeds to checkout — platform fee line item is clearly visible (e.g., 7% = $0.28 on a $4 order).
4. **Mock payment** completes — order confirmation shown.
5. **Future Order demo:**
   - Consumer types **"I need 10 oranges within the next 2 days"** — app calls `POST /ai/parse-demand`, shows parsed result (quantity: 10, category: fruit, expires in 48h), consumer confirms → `POST /future-orders` saves the open demand.
   - Presenter switches to producer account and posts an orange listing.
   - Consumer account receives a notification: *"A producer near you just listed oranges matching your request!"*
6. *(Bonus)* Consumer sets up a weekly subscription for the zucchini.
7. *(Bonus)* Broker view — aggregate basket across multiple producers.
