# Demo Scenario 1 — AI Search → Checkout

**Target time:** < 90 seconds  
**Account:** demo-consumer@test.com / password123  
**Setup:** `psql $DATABASE_URL < demo/seed-data.sql`

---

## Click Path

| Step | Action | Expected | Target time |
|------|--------|----------|-------------|
| 1 | Navigate to http://localhost:5173/ | Landing page loads, no console errors | 2s |
| 2 | Click "Sign In" → enter demo-consumer@test.com / password123 → submit | Redirected to dashboard | 8s |
| 3 | Click "Search with AI" or navigate to /search | AI search bar visible | 3s |
| 4 | Type: **"Find me some zucchini"** → press Enter or click Search | Loading skeleton appears immediately | 2s |
| 5 | Wait for results | ≥1 ListingCard visible; explanation text rendered above cards | 5s |
| 6 | Click **"Add to Cart"** on the Fresh Zucchini card | Cart icon count updates; toast appears | 2s |
| 7 | Navigate to /cart | Line item visible; subtotal shown; estimated 7% fee as line item | 3s |
| 8 | Click **"Proceed to Checkout"** | Redirected to /checkout; Stripe PaymentElement renders | 3s |
| 9 | Enter Stripe test card: `4242 4242 4242 4242`, exp `12/34`, CVC `123`, ZIP `88001` | Fields fill without error | 10s |
| 10 | Click **"Pay"** | Processing spinner; no errors | 5s |
| 11 | Payment completes | Redirected to /orders/:id/confirmation | 5s |
| 12 | Point to confirmation page | Subtotal, platform fee (7%), and total all visible as separate line items | 5s |

**Total: ~53 seconds** (well within the 90-second target)

---

## Verification Checkpoints

- [ ] No console errors at any step
- [ ] AI explanation string is non-empty and visible
- [ ] Cart shows fee % correctly (7% of subtotal)
- [ ] Order confirmation shows 3 line items: Subtotal / Platform fee (7%) / Total
- [ ] DB: `SELECT status FROM orders ORDER BY created_at DESC LIMIT 1;` → `paid`
- [ ] DB: `SELECT quantity_available FROM listings WHERE id = 'aaaa0001-...'` → decremented

---

## Contingency

| Problem | Fallback |
|---------|---------|
| AI search returns 500 | Navigate to /browse?q=zucchini — show keyword search works |
| Stripe PaymentElement fails to render | Check Stripe publishable key in .env; use demo mode (`STRIPE_SECRET_KEY` empty) |
| Payment times out | Stripe demo mode creates orders as paid directly — unset the key |
| No listings returned | Verify seed data loaded: `SELECT count(*) FROM listings WHERE is_available = true;` |
