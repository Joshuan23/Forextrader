# Launch Punch List — ForexTrader Pro

The exact remaining steps between this codebase and recurring revenue, in order.
Code that exists is done; everything below is either config, deployment, or marketing reps.

## Positioning (decided)

- **Who:** prop-firm challenge traders (FTMO-style evaluations and funded accounts).
- **Wedge:** the Challenge Tracker + free calculators. Signals/COT/backtesting are the retention layer.
- **Autopilot engine:** free `/tools/*` calculator pages rank for long-tail searches
  ("eur/usd position size calculator", "prop firm drawdown calculator") and funnel into the trial.

## Week 1 — Ship

- [ ] Buy domain, set `NEXT_PUBLIC_SITE_URL` (used by sitemap, robots, and OG metadata).
- [ ] Deploy to Vercel (repo already has `.vercel` gitignored; `next build` is clean).
- [ ] Stripe: create the live-mode Product + Price, set `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` and `SESSION_SECRET` in Vercel env.
- [ ] Point the Stripe webhook at `https://<domain>/api/stripe/webhook`, send a test event.
- [ ] Run one full end-to-end test purchase in live mode, then refund it.
- [ ] Set the Mailchimp env vars so `/api/waitlist` writes to the real audience.
- [ ] Submit the sitemap in Google Search Console.

### Pricing decision

The design doc says $99/mo. For the prop-trader wedge, test **$29/mo** first:
challenge traders already spend $100–500 per attempt, but they buy tools impulsively at
sub-$30 price points. A/B by cohort later; do not build a pricing page — one price, one CTA.

## Weeks 2–4 — First 50 customers (manual, not autopilot)

- [ ] Post the free drawdown calculator (not the paid product) in r/Forex, r/Daytrading,
      and two prop-firm Discords. Free tool posts survive moderation; sales posts don't.
- [ ] DM engaged commenters an early-access link with a founding-member price lock.
- [ ] Ask every trial user one question: "what almost made you not sign up?" Fix that.
- [ ] Convert the waitlist with a launch email (Mailchimp flow already wired).

## Months 2–3 — Turn on the autopilot

- [ ] Expand programmatic SEO: add `/tools/position-size-calculator/<pair>` coverage for
      more crosses (add pairs to `lib/forex/pairs.ts` — pages generate automatically).
- [ ] Add 2–3 more free tools: pip value calculator, risk-of-ruin calculator,
      session-time tool ("best time to trade <pair>"). Same shell, same CTA.
- [ ] Publish 4 SEO articles/month targeting "how to pass <firm> challenge"-shaped queries
      (the article workflow in `docs/freelance/` already exists — reuse it for ourselves).
- [ ] Weekly signal screenshot on X/Twitter with a tools link (15 min/week).
- [ ] Monthly churn email: signal performance recap generated from app data.

## Metrics that matter (ignore the rest)

| Metric | Target by Month 3 |
|---|---|
| Indexed tool pages | 15+ |
| Organic clicks/day | 50+ |
| Trial starts/week | 20+ |
| Trial → paid conversion | 40%+ |
| Paying subscribers | 100 ($2.9k MRR at $29) |

## Known gaps (deliberate, don't fix yet)

- Challenge Tracker persists in localStorage, not a DB — fine until users ask for
  multi-device sync; that's the first post-revenue feature.
- No trailing-drawdown model (some firms use it) — add when a paying user asks.
- Email login is magic-link-less (Stripe session cookie only) — sufficient for launch.
