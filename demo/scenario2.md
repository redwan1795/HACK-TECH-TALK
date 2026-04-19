# Demo Scenario 2 — Future Order → Notification

**Target time:** < 60 seconds  
**Accounts:**
- Consumer: demo-consumer@test.com / password123
- Producer:  demo-producer@test.com / password123
**Setup:** `psql $DATABASE_URL < demo/seed-data.sql`  
**Notification:** Configure SendGrid to deliver to a mailtrap.io inbox

---

## Click Path

| Step | Action | Expected | Target time |
|------|--------|----------|-------------|
| 1 | Log in as **demo-consumer@test.com** | Dashboard visible | 8s |
| 2 | Navigate to /future-orders/new | Future Order form visible | 2s |
| 3 | Type: **"I need 10 oranges within the next 2 days"** → click "Parse my request" | Loading… then confirmation card appears | 6s |
| 4 | Confirmation card shows | Product: oranges · Qty: 10 · Expiry: ~48h from now | 2s |
| 5 | Click **"Confirm & Save"** | 201 response; "We'll notify you" success state | 2s |
| 6 | Open new tab → navigate to http://localhost:5173/login | Login page | 3s |
| 7 | Log in as **demo-producer@test.com** | Producer dashboard | 5s |
| 8 | Navigate to /listings/new | Create listing form | 2s |
| 9 | Fill in: Title = **"Navel Oranges"**, Category = Fruit, Price = $2.00/lb, Qty = 20, ZIP = 88001 → submit | 201 created | 8s |
| 10 | On producer dashboard, click **Publish** on the Navel Oranges listing | 200; listing shows as active | 3s |
| 11 | Switch to mailtrap.io tab | Email arrives within 5–10 seconds | 10s |
| 12 | Open email | Subject contains "oranges"; body contains listing link | 3s |

**Total: ~54 seconds** (within the 60-second target)

---

## Verification Checkpoints

- [ ] Future order confirmation card shows "oranges", "10", expiry ~48h
- [ ] DB after save: `SELECT status FROM future_orders ORDER BY created_at DESC LIMIT 1;` → `open`
- [ ] Email received in mailtrap with subject "match for your \"oranges\" request"
- [ ] DB after publish + fanout: `SELECT status, matched_listing_id FROM future_orders ORDER BY created_at DESC LIMIT 1;` → `matched`, non-null `matched_listing_id`

---

## Contingency

| Problem | Fallback |
|---------|---------|
| AI parse fails | Show DB row directly: `SELECT * FROM future_orders ORDER BY created_at DESC LIMIT 1;` |
| Email delayed in mailtrap | Show DB `status = 'matched'` to prove fanout ran; explain email is in transit |
| Notification not sent | Check `SENDGRID_API_KEY` in .env; check server console for `[notificationService]` errors |
| Producer publish not triggering fanout | Verify `server/src/routes/listings.ts` has `triggerListingPublishFanout` wired up |

---

## Pre-Demo Checklist

```
[ ] psql $DATABASE_URL < demo/seed-data.sql   # fresh seed
[ ] Server running:  cd server && npm run dev
[ ] Web running:     cd apps/web && npm run dev
[ ] mailtrap.io tab open and inbox cleared
[ ] Both accounts logged out (clear localStorage if needed)
[ ] SENDGRID_API_KEY set and pointing to mailtrap SMTP
```
