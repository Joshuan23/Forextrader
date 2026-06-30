# Design: Revenue From Day 1 — Freelance + Forex SaaS

**Date:** 2026-06-30
**Goal:** Generate immediate cash flow via AI-powered freelance services, then build to $100k ARR via Forex SaaS subscription
**Success criteria:**
- Week 1: 1 paying freelance client ($1,500 MRR)
- Month 2: Forex SaaS live with first 10 paying subscribers ($990 MRR)
- Month 6: 85 SaaS subscribers + 4 freelance clients = ~$14,400/mo ($100k+ ARR)

**Constraints:**
- Zero capital to invest
- Time is the primary resource
- AI (Claude) handles content, copy, research, and delivery
- All tools already connected: Apollo, HubSpot, Calendly, Gmail, Mailchimp, Semrush, Shopify, Google Drive

---

## Track 1: AI Growth Partner Freelance Service

### What We Sell

Done-for-you AI-powered content and growth services for small businesses.

**Primary offer:** SEO Content Package — $1,500/month recurring
- 4 long-form articles per month (1,200–2,000 words each)
- Keyword research via Semrush
- Claude writes, human reviews, client publishes
- Delivered in Google Drive as ready-to-publish drafts

**Upsell offers (once trust is established):**
- Cold outreach campaign setup — $2,000 one-time
- Landing page + copy — $1,200 one-time
- Email nurture sequence (5 emails) — $800 one-time

### Target Customer

**Niche:** Local service businesses — law firms and accounting firms (priority)
**Profile:**
- 2–20 employees
- US-based
- Has a website with low domain authority (DA < 30)
- No active content strategy
- Budget exists (billable-hour businesses)

**Why this niche:** High income, low technical sophistication, clear ROI story ("rank higher → more clients"), and abundant on Apollo.

### Acquisition Funnel

```
Apollo prospecting (50 leads/week)
  → 3-email cold sequence (Gmail)
    → Discovery call (Calendly, 20 min)
      → Close ($1,500/mo, invoice via Stripe)
        → Deliver first article within 48 hours
```

**Cold email sequence (3 emails):**

Email 1 (Day 0) — Pain opener:
> Subject: [Firm name]'s Google ranking
> Body: Point out their low ranking for a specific keyword their competitors rank for. Offer to fix it. One CTA: 15-min call.

Email 2 (Day 3) — Social proof + offer:
> Subject: What we did for [similar firm]
> Body: Specific result (traffic increase, leads). Restate offer. Link to Calendly.

Email 3 (Day 5) — Easy yes:
> Subject: Last note
> Body: Low-pressure. Offer a free first article as proof of quality. Calendly link.

**Discovery call script (20 min):**
1. (5 min) Ask: "How are you currently getting new clients?" → surface pain
2. (5 min) Present: "We produce 4 SEO articles/month targeting your ideal clients' search terms"
3. (5 min) Show: example article (produced by Claude, demonstrate quality)
4. (5 min) Ask for the sale: "$1,500/month, cancel anytime, first article in 48 hours"

### Delivery System

**Per article workflow:**
1. Semrush keyword research (target keyword, volume, difficulty)
2. Claude produces 1,500-word article with H1/H2 structure, internal link placeholders, meta description
3. Human review (15 min): fact-check, add client-specific details
4. Deliver via Google Drive shared folder
5. Optional: post to client's CMS directly

**Time per article:** ~30 min human time (Claude handles the rest)
**Time per client per month:** ~2 hours
**Capacity at current tools:** 8–10 clients before needing to hire

### Revenue Model

| Clients | MRR | Annual |
|---------|-----|--------|
| 1 | $1,500 | $18,000 |
| 3 | $4,500 | $54,000 |
| 5 | $7,500 | $90,000 |

---

## Track 2: Forex SaaS — Subscription Paywall

### What We're Selling

Access to the existing Forextrader app — SMC signals, FVG detection, order block analysis, COT data, backtesting engine, and live price charts.

**Pricing:** $99/month, single tier, Pro plan only
**Trial:** 7 days free, credit card required upfront
**Billing:** Stripe recurring subscription

### What Needs to Be Built

#### 2.1 Stripe Subscription Paywall
- Stripe Checkout for subscription signup
- Webhook to provision/revoke access on payment events
- User auth tied to subscription status
- `/api/subscription/status` endpoint consumed by frontend

#### 2.2 Landing Page (`/`)
- Headline: "Institutional-Grade Forex Signals. No Guesswork."
- 3 feature bullets: SMC signals, COT analysis, backtesting
- Screenshot or short screen-recorded demo
- Single CTA: "Start 7-Day Free Trial — $99/mo after"
- No pricing page, no feature comparison — one offer only

#### 2.3 Email Capture (pre-launch)
- Simple waitlist form (name + email) on landing page before paywall goes live
- Mailchimp integration to collect and announce launch
- Target: 50 emails before opening subscriptions

### Acquisition Strategy (zero ad spend)

**Week 1–2 (pre-launch):**
- Post signal screenshots to r/Forex, r/algotrading, r/FuturesTrading
- Framing: "I built this to trade SMC — want to try it?"
- Collect waitlist emails, do not charge yet
- DM engaged commenters with early access offer

**Week 3+ (post-launch):**
- Convert waitlist to paid ($99/mo, 7-day trial)
- Offer freelance content clients a free month → word of mouth
- SEO articles (from Track 1) targeting "SMC forex signals", "COT forex analysis", "Smart Money Concepts tool"
- Twitter/X: weekly signal post with app screenshot + link

### Revenue Model

| Subscribers | MRR | ARR |
|-------------|-----|-----|
| 10 | $990 | $11,880 |
| 30 | $2,970 | $35,640 |
| 85 | $8,415 | $100,980 |
| 100 | $9,900 | $118,800 |

### Churn Mitigation
- Monthly "signal performance" email showing wins (Claude-generated from app data)
- Quarterly feature drop to give subscribers reason to stay
- Pause option before cancel (reduce hard churn)

---

## Combined Revenue Projection

| Month | Freelance MRR | SaaS MRR | Total MRR | ARR Run Rate |
|-------|--------------|----------|-----------|--------------|
| 1 | $3,000 | $0 | $3,000 | $36,000 |
| 2 | $4,500 | $990 | $5,490 | $65,880 |
| 3 | $6,000 | $2,970 | $8,970 | $107,640 |
| 6 | $6,000 | $8,415 | $14,415 | $172,980 |

**$100k ARR achieved by end of Month 3 at plan trajectory.**

---

## Architecture Overview

### Track 1 (Freelance) — No Code Needed
- Apollo → leads
- Gmail → outreach
- Calendly → calls
- Stripe → invoicing
- Google Drive → delivery
- Claude → content production

### Track 2 (SaaS) — Code Required
- Existing Next.js app (Forextrader)
- Add: Stripe webhook handler (`/api/stripe/webhook`)
- Add: Auth middleware checking subscription status
- Add: Landing page (`app/page.tsx` — replace current)
- Add: Subscription status API (`app/api/subscription/route.ts`)
- Database: store `user_id → stripe_customer_id → subscription_status`

---

## Implementation Constraints

- DRY, YAGNI — add only what's needed for paywall and landing page
- No new UI libraries — use existing Tailwind + shadcn components
- Stripe test mode first, switch to live after first successful payment
- No email auth system yet — use Stripe Customer Portal for account management
- Mobile layout is secondary — trading dashboard is desktop-first

---

## Open Questions (resolved)

- ~~Which niche for freelance?~~ → Law firms and accounting firms
- ~~What price for SaaS?~~ → $99/month, one tier
- ~~Free trial or not?~~ → 7-day free trial, card required
- ~~Build audience first or launch immediately?~~ → Waitlist first (2 weeks), then launch
