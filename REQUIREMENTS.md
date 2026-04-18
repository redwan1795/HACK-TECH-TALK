# Community Garden — Product Requirements Document (PRD)

**Document purpose:** Define scope, stakeholders, and functional expectations for the hackathon build and for prompting AI-assisted development.  
**Product name:** Community Garden  
**Platforms:** Web application **and** mobile application (shared backend; responsive web + native or cross-platform mobile per team choice).

---

## 1. Vision

Connect **local producers** (home gardeners and licensed small farmers) with **consumers** and **brokers** who want fresh produce, flowers, and eggs—sourced from **backyards and home gardens**—while enabling **fair monetization** for the platform and optional **small-scale financing** for new farmers.

---

## 2. Stakeholders

| Role | Description |
|------|-------------|
| **Platform operator** | Owns the app; earns a percentage on monetary transactions. |
| **Producer — Home grower** | Individual growing at home; **does not** have a license to sell commercially (constraints may apply by jurisdiction; product should model “exchange / informal / compliance flags” per MVP). |
| **Producer — Small farmer** | Licensed to sell (e.g., farmer’s market); can list saleable inventory at scale. |
| **Consumer — Individual** | Buys, **exchanges**, or **subscribes** to recurring consumption from **multiple** producers; expects proximity-based matching and consumption-pattern alignment (see §6). |
| **Consumer — Broker** | Third party who **buys** from individuals and **resells** to farmers’ markets, restaurants, suppliers, etc., **at their own risk/responsibility**; app facilitates discovery and transaction rails where allowed. |
| **Mentor** | Supports new farmers under the financing program; **compensated when** the new farmer achieves a defined **success story** (see §8). |
| **Third-party lender** | External lending app/API; platform integrates or deep-links rather than originating loans in MVP unless legally scoped. |

---

## 3. Product Catalog (MVP scope)

Supported product categories:

1. Fruits  
2. Vegetables  
3. Flowers  
4. Eggs  

**Origin constraint:** Listings originate **in the producer’s own garden or backyard** (location/context captured on listing).

---

## 4. Consumer Journeys

### 4.1 Individual consumer

- **Buy:** One-off purchases from producers (proximity-aware).  
- **Exchange:** Facilitate barter or non-cash exchange where the team defines rules for the hackathon demo (e.g., credit/points vs. literal swap).  
- **Subscribe:** Weekly (or recurring) consumption bundles sourced from **multiple** producers; user sets preferences and constraints.  
- **Matching:** The app should **match consumption patterns** with available supply from **nearby** producers.  
- **Intelligence:** Use **AI + prompt** (see §6) to interpret natural-language preferences (diet, allergies, organic intent, quantity, schedule) and suggest producers/listings.

### 4.2 Broker

- Browse and purchase (or commit to) crops from individual producers.  
- Resell through their own channels (market, restaurant, logistics); **legal and operational responsibility stays with the broker**; app should surface disclaimers and role-appropriate flows (wholesale vs. retail pricing optional for MVP).

---

## 5. Producer capabilities

- **Profile:** Role = home grower vs. small farmer; license/seller flag for small farmer.  
- **Listings:** Product type, quantity/unit, harvest or availability window, photos, pickup/delivery options, location (**garden/backyard** context).  
- **Compliance note:** Distinguish listing types for unlicensed home growers vs. licensed sellers (exact legal behavior is **out of band** for the hackathon—model with flags and copy).  

---

## 6. AI & prompting

**Goal:** Improve discovery and subscription planning using LLM-assisted interpretation of user intent.

**Minimum viable behaviors:**

- Parse free-text preferences into structured filters (e.g., “no nightshades,” “weekly veg box under $X,” “flowers for events in April”).  
- Suggest producers within **proximity** (define radius or ranking: distance + availability + match score).  
- Explain **why** a producer or bundle was suggested (short rationale).  

**Non-requirements (unless time permits):**

- Autonomous agents placing orders without user confirmation.  
- Guaranteed dietary or medical advice; treat outputs as **suggestions** with disclaimers.

---

## 7. Monetization (platform)

- For **every monetary transaction** processed through the platform, the operator receives **5%–10%** of the transaction (configurable; single rate for MVP demo).  
- Scope: marketplace fee on **completed paid orders** (define whether subscriptions bill weekly and fee applies per billing event).  

---

## 8. Small-scale financing (stretch / phase 2)

- **Partnership:** Integrate with **third-party lender apps** (API, SSO, or deep link) rather than building lending from scratch.  
- **Mentorship:** Assign or match **mentors** to new farmers.  
- **Mentor payment:** Mentor receives payment **if/when** the new farmer achieves a documented **success story** (define hackathon criteria: e.g., N successful sales, revenue threshold, or time-on-platform milestone).  

---

## 9. Functional requirements (hackathon backlog)

Prioritize vertically: **one producer flow + one consumer flow + payments stub + map/search**.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | User registration/login; roles: producer, individual consumer, broker | P0 |
| FR-02 | Producer creates/edits listings (§3 categories, §5 fields) | P0 |
| FR-03 | Browse/search listings with **location** and distance or region | P0 |
| FR-04 | Individual **purchase** checkout (cart or single-item for demo) | P0 |
| FR-05 | **Subscription** model: recurring intent + placeholder billing or mock | P1 |
| FR-06 | **Exchange** flow: defined minimal rules + UI affordance | P2 |
| FR-07 | Broker flow: aggregate buy from producers; separate UX from retail | P1 |
| FR-08 | **AI + prompt**: preference text → structured prefs + ranked suggestions | P1 |
| FR-09 | **Platform fee** 5%–10% applied on paid transactions (transparent line item) | P1 |
| FR-10 | Admin/config: fee percentage, feature flags | P2 |
| FR-11 | Financing: lender link/placeholder; mentor-success **conceptual** UI | P3 |

---

## 10. Non-functional requirements

| ID | Requirement | Notes |
|----|-------------|-------|
| NFR-01 | **Web + mobile** reach same APIs | Contract-first API helps hackathon parallel work |
| NFR-02 | **Privacy** | Location precision configurable; do not over-expose home addresses |
| NFR-03 | **Security** | Auth for writes; rate-limit AI endpoint if public |
| NFR-04 | **Accessibility** | Basic keyboard/contrast on web for demo |
| NFR-05 | **Disclaimers** | Broker responsibility; food safety; AI not medical advice |

---

## 11. Out of scope (typical hackathon)

- Full legal compliance for all jurisdictions.  
- Payment processor certification beyond sandbox/test keys.  
- Own microfinance underwriting.  
- Full logistics routing (e.g., “road runner” integrations).  

---

## 12. Success criteria (hackathon demo)

- **Live demo:** Producer posts a listing; consumer finds it via **search or AI prompt**, completes a **mock or sandbox payment**, fee line item visible.  
- **Story:** Show **proximity** and **multi-producer subscription** intent (can be UI + mocked backend).  
- **Optional:** Broker view purchasing from a producer listing.

---

## 13. Glossary

| Term | Meaning |
|------|---------|
| **Proximity** | Geographic nearness between consumer and producer for matching. |
| **Success story** | Predefined milestone(s) triggering mentor compensation under financing (TBD per implementation). |

---

## 14. Open questions (resolve during kickoff)

1. Exact **fee %** and whether subscriptions use the same rate.  
2. **Exchange** semantics: barter only, internal credits, or both?  
3. **Home grower** selling: demo-only vs. educational “check local laws” mode?  
4. Which **lender** integration is a stub vs. real API keys?  
5. Map provider vs. simple ZIP/distance approximation for MVP.

---

*End of document.*
