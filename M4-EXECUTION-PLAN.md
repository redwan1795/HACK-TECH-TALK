# M4 Execution Plan — Future Orders + Notifications

**Milestone goal:** Consumers post a demand signal in natural language. When a matching producer listing is published within proximity and time window, the consumer receives an email notification. Completes Demo Scenario 2.

**FR covered:** FR-11  
**Estimated effort:** 10–12 hours  
**Parallel split:** Dev A → backend services + routes + fanout job (~6h) · Dev B → frontend pages + tests (~5h)

---

## Entry Criteria

Before starting M4, verify:

- [ ] M3 exit criteria met (AI search + Stripe checkout fully working)
- [ ] `future_orders` table migrated (`006_create_future_orders.sql` already applied)
- [ ] SendGrid API key in `.env` (`SENDGRID_API_KEY=SG.xxx`)
- [ ] `mailtrap.io` SMTP configured for demo inbox capture
- [ ] `date-fns` package available (`npm install date-fns` in `server/`)
- [ ] `@sendgrid/mail` package installed (`npm install @sendgrid/mail` in `server/`)

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/src/prompts/demandParseSystem.txt` | System prompt for demand intent extraction |
| `server/src/services/demandParseService.ts` | Claude `tool_use` demand parser |
| `server/src/services/notificationService.ts` | SendGrid wrapper |
| `server/src/jobs/listingPublishFanout.ts` | Match + notify on listing publish |
| `server/src/routes/future-orders.ts` | REST routes for future orders |
| `apps/web/src/pages/FutureOrderPage.tsx` | Consumer demand entry form |
| `apps/web/src/pages/FutureOrdersListPage.tsx` | Consumer demand history list |
| `server/src/__tests__/futureOrders.test.ts` | Integration + unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `server/src/routes/ai.ts` | Add `POST /parse-demand` endpoint |
| `server/src/routes/listings.ts` | Trigger fanout in `PATCH /:id/publish` |
| `server/src/index.ts` | Wire real future-orders router (replace 501 stub) |
| `apps/web/src/App.tsx` | Replace future-orders PlaceholderPage with real pages |

---

## Step-by-Step Implementation

### Step 1 — System Prompt for Demand Parsing

**File:** `server/src/prompts/demandParseSystem.txt`

```
You are a demand intent parser for a local produce marketplace.
Extract the consumer's demand from their message and call the create_future_order tool.

Rules:
- product_keyword: the primary produce item (lowercase, singular preferred)
- quantity: numeric amount; if unstated, use 1
- unit: lb, kg, dozen, unit, bunch, bag — infer from context; default "unit"
- needed_by_date: convert relative expressions ("in 2 days", "by Friday", "next week")
  to ISO 8601 UTC timestamps; if no date mentioned, return null
- max_price_cents: only set if the user mentions a price limit; otherwise omit
- zip: extract from the message if present; otherwise omit
- proximity_miles: default 25 unless user specifies

Always call the tool. Never respond with plain text.
```

---

### Step 2 — Demand Parse Service

**File:** `server/src/services/demandParseService.ts`

**Purpose:** Accept a freetext consumer query, call Claude with `tool_choice: { type: 'tool', name: 'create_future_order' }`, normalize relative dates with `date-fns`, and return the parsed intent.

**Claude tool definition:**

```typescript
const DEMAND_TOOL: Anthropic.Tool = {
  name: 'create_future_order',
  description: 'Parse a consumer demand into structured fields',
  input_schema: {
    type: 'object',
    properties: {
      product_keyword: { type: 'string' },
      quantity:        { type: 'number' },
      unit:            { type: 'string' },
      needed_by_date:  { type: 'string', description: 'ISO 8601 UTC or null' },
      max_price_cents: { type: 'number' },
      zip:             { type: 'string' },
      proximity_miles: { type: 'number' },
    },
    required: ['product_keyword', 'quantity', 'unit'],
  },
};
```

**Exported interface:**

```typescript
export interface DemandIntent {
  product_keyword: string;
  quantity:        number;
  unit:            string;
  needed_by_date:  string | null;  // ISO 8601
  max_price_cents: number | null;
  zip:             string | null;
  proximity_miles: number;
}
```

**Exported function:** `parseDemandIntent(query: string): Promise<DemandIntent>`

**Date normalization:** The system prompt instructs Claude to emit ISO 8601. Validate with `isValid(parseISO(needed_by_date))` from `date-fns`. If the string is invalid, set `needed_by_date = null`.

**Error handling:** Wrap Claude call in try/catch. On any failure, throw a typed `DemandParseError extends Error` — never let raw errors propagate to the route.

**System prompt loading:** Mirror `aiSearchService.ts` — `fs.readFileSync` at module load, cached in a module-level constant.

---

### Step 3 — Notification Service

**File:** `server/src/services/notificationService.ts`

**Purpose:** SendGrid wrapper. One exported function. Fire-and-forget — caller does not await errors.

```typescript
import sgMail from '@sendgrid/mail';
import { env } from '../config/env';

sgMail.setApiKey(env.sendgridApiKey);

export interface FutureOrderRow {
  id: string;
  consumer_id: string;
  product_keyword: string;
  quantity_needed: number;
  unit: string;
}

export interface ListingRow {
  id: string;
  title: string;
  location_zip: string;
}

export interface ConsumerRow {
  email: string;
  name: string;
}

export async function sendFutureOrderMatch(
  futureOrder: FutureOrderRow,
  listing: ListingRow,
  consumer: ConsumerRow,
): Promise<void> {
  const listingUrl = `${env.webBaseUrl ?? 'http://localhost:5173'}/listings/${listing.id}`;
  try {
    await sgMail.send({
      to:      consumer.email,
      from:    'noreply@communitygarden.local',
      subject: `A match for your "${futureOrder.product_keyword}" request is available!`,
      html: `
        <p>Hi ${consumer.name},</p>
        <p>Good news! A producer just listed <strong>${listing.title}</strong>
           near ZIP ${listing.location_zip} that matches your demand for
           ${futureOrder.quantity_needed} ${futureOrder.unit} of
           ${futureOrder.product_keyword}.</p>
        <p><a href="${listingUrl}">View the listing →</a></p>
      `,
    });
  } catch (err) {
    console.error('[notificationService] SendGrid error:', err);
    // fire-and-forget — swallow error so caller is unaffected
  }
}
```

**Important:** Add `webBaseUrl: process.env.WEB_BASE_URL ?? ''` to `server/src/config/env.ts`.

---

### Step 4 — Listing Publish Fanout Job

**File:** `server/src/jobs/listingPublishFanout.ts`

**Purpose:** Called via `setImmediate` inside the publish route so it does not block the HTTP response. Queries open, non-expired `future_orders` with matching keyword and proximity to the published listing, sends notifications, and updates matched records.

**Exported function:** `triggerListingPublishFanout(listingId: string): void`  
(synchronous wrapper — fires `setImmediate` and returns immediately)

**Internal async function:** `runFanout(listingId: string): Promise<void>`

**Algorithm:**

```
1. Fetch listing: id, title, category, location_zip, location_lat, location_lng

2. Query open future orders:
   SELECT fo.*, u.email, u.name
   FROM future_orders fo
   JOIN users u ON u.id = fo.consumer_id
   WHERE fo.status = 'open'
     AND fo.expires_at > NOW()
     AND (
       to_tsvector('english', fo.product_keyword) @@ plainto_tsquery('english', $listing_title_keyword)
       OR fo.category = $listing_category
     )

3. For each candidate future order:
   a. Geocode future_order.zip → (foLat, foLng)
   b. Compute haversine distance between (foLat, foLng) and (listingLat, listingLng)
   c. If distance ≤ future_order.proximity_miles:
      - Call sendFutureOrderMatch(futureOrder, listing, consumer)
      - UPDATE future_orders SET status = 'matched', matched_listing_id = $listingId
        WHERE id = $futureOrderId

4. Swallow all errors (log only) — must not crash the process
```

**Proximity matching detail:** The SQL pre-filter uses full-text search to narrow candidates. The final distance check uses the same `haversineDistance` utility from `listingService.ts` (re-export or move to shared util).

**Case-insensitive keyword matching:** `plainto_tsquery` is case-insensitive by default with the `english` dictionary. "Orange" matches "orange" automatically.

---

### Step 5 — Future Orders Routes

**File:** `server/src/routes/future-orders.ts`

Three endpoints, all require `authenticate`. `POST /` and `GET /` require `consumer` role. `DELETE /:id` requires the record owner.

#### `POST /future-orders` — Save confirmed demand

**Validation:**
- `product_keyword`: notEmpty, trim
- `quantity_needed`: isFloat({ min: 0.01 })
- `unit`: notEmpty, trim
- `needed_by_date`: optional, isISO8601
- `max_price_cents`: optional, isInt({ min: 0 })
- `zip`: isPostalCode('US')
- `proximity_miles`: optional, isInt({ min: 1, max: 500 }), default 25
- `expires_at`: isISO8601; must be in the future — if not, return 400 `INVALID_EXPIRY`
- `product_query`: notEmpty, trim (original freetext for audit)

**DB insert:**

```sql
INSERT INTO future_orders
  (consumer_id, product_query, product_keyword, category, quantity_needed,
   unit, max_price_cents, proximity_miles, zip, expires_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
RETURNING *
```

`category` is optional — set from parsed intent if `product_keyword` maps to a known category; otherwise null.

**Response:** 201 with inserted row.

#### `GET /future-orders` — List own demands

```sql
SELECT * FROM future_orders
WHERE consumer_id = $1
ORDER BY created_at DESC
```

No pagination needed for M4.

#### `DELETE /future-orders/:id` — Cancel demand

1. Fetch row; 404 if not found.
2. 403 if `consumer_id !== req.user.sub`.
3. `UPDATE future_orders SET status = 'cancelled' WHERE id = $1 RETURNING *`
4. Return 200 with updated row.

---

### Step 6 — AI Route: Parse-Demand Endpoint

**File:** `server/src/routes/ai.ts` — add to existing router

```typescript
router.post(
  '/parse-demand',
  authenticate,
  authorize('consumer'),  // producers cannot post future orders
  body('query').notEmpty().trim().isLength({ max: 1000 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      return;
    }
    try {
      const intent = await parseDemandIntent(req.body.query as string);
      res.json(intent);
    } catch (err) {
      if (err instanceof DemandParseError) {
        res.status(422).json({ error: { code: 'PARSE_FAILED', message: err.message } });
        return;
      }
      next(err);
    }
  }
);
```

**Note:** This endpoint does NOT save to DB — it only parses and returns the intent. The frontend confirmation step calls `POST /future-orders` to actually save.

---

### Step 7 — Wire Fanout into Listings Publish Route

**File:** `server/src/routes/listings.ts` — modify `PATCH /:id/publish`

After the successful `UPDATE listings SET is_available = $1` call, if `publish === true`:

```typescript
if (publish) {
  // fire-and-forget: does not affect HTTP response
  triggerListingPublishFanout(req.params.id);
}
res.json(updated[0]);
```

Import `triggerListingPublishFanout` from `'../jobs/listingPublishFanout'`.

---

### Step 8 — Wire Router in index.ts

**File:** `server/src/index.ts`

Replace the existing stub:

```typescript
// BEFORE (stub):
app.use('/api/v1/future-orders', (_req, res) => res.status(501).json({ error: 'Not implemented' }));

// AFTER:
import futureOrdersRouter from './routes/future-orders';
app.use('/api/v1/future-orders', futureOrdersRouter);
```

---

### Step 9 — Frontend: FutureOrderPage

**File:** `apps/web/src/pages/FutureOrderPage.tsx`  
**Route:** `/future-orders/new`  
**Access:** Consumer only (wrap in `ProtectedRoute role="consumer"`)

**UI states:**

```
State 1 — INPUT
  <textarea> freetext demand input
  <button> "Parse my request"
  Calls POST /ai/parse-demand

State 2 — CONFIRMATION (after parse success)
  Confirmation card showing:
    Product: oranges
    Quantity: 10 unit
    Needed by: April 21, 2026
    ZIP: 88001
    Max price: (none)
  <button> "Confirm & Save"  → calls POST /future-orders
  <button> "Edit"            → back to State 1

State 3 — SUCCESS (after save)
  "We'll notify you when a match is found!"
  <Link to="/future-orders"> View my requests
```

**API calls:**
- `POST /api/v1/ai/parse-demand` with body `{ query }`
- `POST /api/v1/future-orders` with the parsed intent plus `expires_at` (default: `needed_by_date` from parse result, or 7 days from now if null) and `product_query` (original input text)

**Error handling:** Show inline error message on parse failure; keep user in State 1.

---

### Step 10 — Frontend: FutureOrdersListPage

**File:** `apps/web/src/pages/FutureOrdersListPage.tsx`  
**Route:** `/future-orders`  
**Access:** Consumer only

**Data fetch:** `GET /api/v1/future-orders` via TanStack Query.

**Renders a table or card list.** Each row shows:
- `product_keyword` + `quantity_needed` + `unit`
- `expires_at` formatted as "Expires Apr 21, 2026"
- Status badge:
  - `open` → green badge "Open"
  - `matched` → blue badge "Matched" + link to matched listing if `matched_listing_id` is set
  - `expired` → gray badge "Expired"
  - `cancelled` → red badge "Cancelled"
- Cancel button (visible only for `open` items) → calls `DELETE /future-orders/:id`

**Empty state:** "You have no future orders yet. [Post a demand →]"

---

### Step 11 — App Router Update

**File:** `apps/web/src/App.tsx`

Replace the future-orders PlaceholderPage entries with:

```tsx
import FutureOrderPage from './pages/FutureOrderPage';
import FutureOrdersListPage from './pages/FutureOrdersListPage';

// In routes:
<Route path="/future-orders/new" element={
  <ProtectedRoute role="consumer"><FutureOrderPage /></ProtectedRoute>
} />
<Route path="/future-orders" element={
  <ProtectedRoute role="consumer"><FutureOrdersListPage /></ProtectedRoute>
} />
```

---

## Test Cases (from TEST-PLAN.md §7)

### Unit Tests — Demand Parse Service

**File:** `server/src/__tests__/demandParseService.test.ts`

| ID | Test | Setup | Assertion |
|----|------|-------|-----------|
| M4-U-01 | Extracts product keyword from "I need 10 oranges" | Mock Claude to return `{ product_keyword: 'oranges', quantity: 10, unit: 'unit' }` | `result.product_keyword === 'oranges'` |
| M4-U-02 | Extracts quantity from "10 oranges" | Same mock above | `result.quantity === 10` |
| M4-U-03 | Converts "in 2 days" to ISO 8601 | Mock Claude to return `needed_by_date: '<ISO ~48h from now>'` | `result.needed_by_date` is valid ISO string; `new Date(result.needed_by_date) > Date.now()` |
| M4-U-04 | Returns null for `needed_by_date` when no date given | Mock Claude to return `needed_by_date: null` | `result.needed_by_date === null`; no throw |
| M4-U-05 | Throws `DemandParseError` on Claude API failure | `jest.mock('@anthropic-ai/sdk')` to throw | `await expect(parseDemandIntent('...')).rejects.toBeInstanceOf(DemandParseError)` |

**Test setup for Claude mock:**

```typescript
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'create_future_order',
          input: { product_keyword: 'oranges', quantity: 10, unit: 'unit', needed_by_date: null },
        }],
      }),
    },
  })),
}));
```

---

### Unit Tests — Future Order Fanout

**File:** `server/src/__tests__/listingPublishFanout.test.ts`

| ID | Test | Setup | Assertion |
|----|------|-------|-----------|
| M4-U-06 | Returns matching open orders for a listing | DB has open future_order with `product_keyword='oranges'`, listing has title containing "orange" | Returned array contains the matching order |
| M4-U-07 | Excludes expired future orders | Future order has `expires_at` = yesterday | Order absent from fanout candidates |
| M4-U-08 | Excludes already-matched orders | Future order has `status = 'matched'` | Order absent from results |
| M4-U-09 | Excludes orders outside proximity radius | Future order zip is 50 miles away; `proximity_miles = 25` | Order excluded after distance check |
| M4-U-10 | Case-insensitive keyword match | Future order `product_keyword = 'Orange'`; listing title "navel oranges" | Match found |
| M4-U-11 | Matches by category when keyword is generic "fruit" | Future order `category = 'fruit'`; listing `category = 'fruit'` | Match found |

**Test approach:** These tests work against the test DB. Each test inserts seed data in a transaction, calls `runFanout(listingId)` directly (the internal async function), then asserts DB state and mock calls.

---

### Unit Tests — Notification Service

**File:** `server/src/__tests__/notificationService.test.ts`

| ID | Test | Setup | Assertion |
|----|------|-------|-----------|
| M4-U-12 | Calls SendGrid with correct to/subject/body | Mock `@sendgrid/mail`; call `sendFutureOrderMatch(...)` | `sgMail.send` called once; `to` equals consumer email |
| M4-U-13 | Email body includes listing title and link | Same mock | `msg.html` contains listing title string and `/listings/:id` URL |
| M4-U-14 | Does not throw on SendGrid error (fire-and-forget) | Mock `sgMail.send` to reject | `await expect(sendFutureOrderMatch(...)).resolves.toBeUndefined()` — no rejection propagated |

**Mock setup:**

```typescript
import sgMail from '@sendgrid/mail';
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));
```

---

### Integration Tests — Future Order Routes & Fanout

**File:** `server/src/__tests__/futureOrders.test.ts`

All integration tests use Supertest against the Express app with a test database. Claude and SendGrid are mocked.

| ID | Test | HTTP Call | Expected Response |
|----|------|-----------|-------------------|
| M4-I-01 | Parse-demand returns parsed intent | `POST /api/v1/ai/parse-demand` with consumer JWT, `{ query: "I need 10 oranges in 2 days near 88001" }` | 200; body has `product_keyword`, `quantity`, `needed_by_date` |
| M4-I-02 | Parse-demand requires auth | `POST /api/v1/ai/parse-demand` without token | 401 |
| M4-I-03 | Parse-demand rejects producer role | `POST /api/v1/ai/parse-demand` with producer JWT | 403 |
| M4-I-04 | Create future order with status open | `POST /api/v1/future-orders` with consumer JWT and valid body | 201; `status: 'open'` in response and DB |
| M4-I-05 | Rejects `expires_at` in the past | Same but `expires_at` = yesterday | 400; code `INVALID_EXPIRY` |
| M4-I-06 | GET returns only own demands | Consumer A and Consumer B each have a demand; GET as Consumer A | Consumer B's demand absent |
| M4-I-07 | DELETE cancels demand | `DELETE /api/v1/future-orders/:id` | 200; DB `status = 'cancelled'` |
| M4-I-08 | Publish triggers fanout + email notification | Create open future_order for consumer; publish matching listing | `PATCH /listings/:id/publish` returns 200; SendGrid mock called with consumer email |
| M4-I-09 | Expired demand not notified | Create future_order with `expires_at` in past; publish listing | SendGrid mock NOT called |
| M4-I-10 | Out-of-range consumer not notified | Future order ZIP is 100 miles from listing; `proximity_miles = 25` | SendGrid mock NOT called |
| M4-I-11 | Matched record updated in DB | After successful fanout (M4-I-08 scenario) | DB row: `status = 'matched'`, `matched_listing_id = listingId` |
| M4-I-12 | Fanout failure does not fail publish | Mock fanout to throw; publish listing | `PATCH /listings/:id/publish` still returns 200 |

**Integration test helpers needed:**

```typescript
// factories.ts additions
async function createFutureOrder(overrides?: Partial<FutureOrderRow>): Promise<FutureOrderRow>
async function createConsumerUser(): Promise<{ user: UserRow; token: string }>
async function createProducerUser(): Promise<{ user: UserRow; token: string }>
```

**Test structure for M4-I-08 (most complex):**

```typescript
it('M4-I-08: publish triggers fanout and sends notification', async () => {
  // Arrange
  const { user: consumer, token: consumerToken } = await createConsumerUser();
  const { user: producer, token: producerToken } = await createProducerUser();

  // Create open future order for consumer near ZIP 88001
  await createFutureOrder({
    consumer_id: consumer.id,
    product_keyword: 'oranges',
    zip: '88001',
    proximity_miles: 25,
    expires_at: addDays(new Date(), 3).toISOString(),
    status: 'open',
  });

  // Create listing
  const listing = await createListing({
    producer_id: producer.id,
    title: 'Navel Oranges',
    category: 'fruit',
    location_zip: '88001',
    location_lat: 32.31,
    location_lng: -106.77,
    quantity_available: 20,
  });

  // Act: publish listing
  const res = await request(app)
    .patch(`/api/v1/listings/${listing.id}/publish`)
    .set('Authorization', `Bearer ${producerToken}`)
    .send({ publish: true });

  // Wait for setImmediate fanout to complete
  await new Promise(resolve => setImmediate(resolve));

  // Assert
  expect(res.status).toBe(200);
  expect(sgMail.send).toHaveBeenCalledWith(
    expect.objectContaining({ to: consumer.email })
  );
});
```

---

### Frontend Tests — Future Order Pages

**File:** `apps/web/src/__tests__/FutureOrderPage.test.tsx`

| ID | Test | Setup | Assertion |
|----|------|-------|-----------|
| M4-F-01 | Shows parsed intent confirmation card after parse | Mock `POST /ai/parse-demand` to return `{ product_keyword: 'oranges', quantity: 10, needed_by_date: '2026-04-21T00:00:00Z' }`. Fill textarea, click "Parse my request" | Confirmation card visible with "oranges", "10", "Apr 21" text |
| M4-F-02 | Confirm button calls POST /future-orders | After parse (M4-F-01 setup), click "Confirm & Save" | Mock `POST /future-orders` called with correct payload |
| M4-F-03 | Shows success state after saving | Mock `POST /future-orders` to return 201 | "We'll notify you" text visible in DOM |
| M4-F-04 | Status badges render correctly | Render `FutureOrdersListPage` with mock data containing open, matched, expired items | "Open", "Matched", "Expired" badge text visible for respective items |

**File:** `apps/web/src/__tests__/FutureOrdersListPage.test.tsx` for M4-F-04.

---

## Schema Reference (from 006_create_future_orders.sql)

```
future_orders
  id                 UUID      PK
  consumer_id        UUID      FK → users(id)
  product_query      TEXT      original freetext input
  product_keyword    TEXT      parsed keyword (GIN indexed)
  category           listing_category (nullable)
  quantity_needed    NUMERIC(10,2)
  unit               TEXT      default 'unit'
  max_price_cents    INTEGER   nullable
  proximity_miles    INTEGER   default 25
  zip                TEXT
  expires_at         TIMESTAMPTZ
  status             future_order_status  ('open','matched','expired','cancelled')
  matched_listing_id UUID      FK → listings(id)  nullable
  created_at         TIMESTAMPTZ
```

---

## Dependency Installation

```bash
# In server/
npm install @sendgrid/mail date-fns
npm install --save-dev @types/sendgrid__mail  # if types not bundled

# Verify
npx tsc --noEmit
```

---

## Environment Variables

Add to `.env` and `.env.example`:

```
SENDGRID_API_KEY=SG.your_key_here
WEB_BASE_URL=http://localhost:5173
```

Add to `server/src/config/env.ts`:

```typescript
sendgridApiKey: process.env.SENDGRID_API_KEY ?? '',
webBaseUrl:     process.env.WEB_BASE_URL ?? 'http://localhost:5173',
```

---

## Exit Criteria — Demo Scenario 2

| Step | Action | Expected |
|------|--------|----------|
| DS2-01 | Log in as `demo-consumer@test.com` | Authenticated |
| DS2-02 | Navigate to `/future-orders/new` | Future Order form visible |
| DS2-03 | Type "I need 10 oranges within the next 2 days" and submit | Confirmation card: product "oranges", qty 10, expiry ~48h |
| DS2-04 | Click "Confirm & Save" | 201; "We'll notify you" success state |
| DS2-05 | Check DB | `future_orders` row with `status: 'open'` |
| DS2-06 | Switch to `demo-producer@test.com` | Producer dashboard |
| DS2-07 | Create listing: "Navel Oranges, $2/lb, ZIP 88001, category: fruit" | 201 created |
| DS2-08 | Publish the listing | 200; `status: 'active'` |
| DS2-09 | Check mailtrap.io inbox | Email received, subject contains "oranges", body contains listing link |
| DS2-10 | Check DB | `future_orders` row: `status = 'matched'`, `matched_listing_id` set |
| **Total time** | | **< 60 seconds** |

---

## Implementation Order (recommended)

```
Hour 1–2  (Dev A)  Step 1–2: demandParseSystem.txt + demandParseService.ts
Hour 1–2  (Dev B)  Step 9:   FutureOrderPage.tsx skeleton + State 1 UI
Hour 3    (Dev A)  Step 3:   notificationService.ts
Hour 3    (Dev B)  Step 10:  FutureOrdersListPage.tsx
Hour 4    (Dev A)  Step 4:   listingPublishFanout.ts
Hour 4    (Dev B)  Step 11:  App.tsx route wiring + smoke test frontend
Hour 5    (Dev A)  Steps 5–8: routes + wiring + index.ts
Hour 5    (Dev B)  Frontend unit tests (M4-F-01 to M4-F-04)
Hour 6    (Dev A)  Integration tests (M4-I-01 to M4-I-12) + unit tests
Hour 7–8  (Both)  Demo Scenario 2 end-to-end rehearsal + bug fixes
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| SendGrid delivery delay in demo | Use `mailtrap.io` — SMTP delivery is near-instant |
| `setImmediate` fanout completes after test assertion | In tests, `await new Promise(r => setImmediate(r))` before asserting DB state |
| date-fns relative date edge cases | Mock `Date.now()` in unit tests; test "in 2 days" as a fixed reference point |
| Proximity match false negatives (geocode cache cold) | Seed both ZIPs in test fixture; pre-warm geocode cache in test setup |
| Claude latency on parse-demand during demo | Show loading spinner immediately; Claude Haiku is fastest model — typically < 1s |
