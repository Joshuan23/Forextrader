# FlowEdge — Production Setup (Real Data)

FlowEdge defaults to **real data**. Demo stores and mock providers are reachable only when
`DEVELOPMENT_DEMO_MODE=true` is set explicitly. In production without the required services,
API routes return **503 with setup guidance** and the pages render the exact problem — the app
never silently falls back to fake data.

## 1. Database (required)

1. Create a Postgres database (Supabase → Project Settings → Database, or Neon).
2. In Vercel → Settings → Environment Variables set `DATABASE_URL`.
3. Push the schema and (optionally) seed pairs:

```bash
npx prisma db push
npx tsx prisma/seed.ts        # optional: pair catalog + starter rows
```

## 2. Supabase (mobile auth, entitlements, push)

1. Create a Supabase project → run `mobile/supabase/schema.sql` in the SQL editor.
2. Set server-side env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (never exposed to clients).
3. Mobile env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## 3. TradingView ingestion (required for real signals)

1. Set `TRADINGVIEW_WEBHOOK_SECRET` (long random string).
2. Add `pine/flowedge-signal-feeder.pine` to your TradingView chart (Pine v6).
3. Create an alert → Webhook URL `https://<deployment>/api/webhooks/tradingview`,
   message = the indicator's JSON payload (includes the secret).
4. Every alert is logged raw (`RawWebhookLog`), validated (Zod), enriched, scored,
   planned, persisted, and — if approved A/B — pushed to entitled devices.

## 4. Economic calendar (required in production)

Set `CALENDAR_API_KEY` to a [Finnhub](https://finnhub.io) API key (free tier works).
Real event times drive the news-blackout kill-switch. If the provider is down, the engine
degrades to the deterministic template calendar (over-approximates blackouts — safe direction)
and logs the failure. Without a key and without demo mode, scans fail loudly.

## 5. RevenueCat (real subscriptions)

1. Create products: `flowedge_pro_monthly`, `flowedge_pro_yearly`,
   `flowedge_elite_monthly`, `flowedge_elite_yearly`; entitlements `pro`, `elite`.
2. Webhook: RevenueCat → Integrations → Webhooks → URL
   `https://<deployment>/api/webhooks/revenuecat`, Authorization = `REVENUECAT_WEBHOOK_AUTH`.
3. Set `REVENUECAT_SECRET_KEY` (secret API key) to enable server-side recovery sync
   (`POST /api/subscription/sync`), so a missed webhook can never strand a paying user.
4. Mobile env: `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.

## 6. Mobile app

```
EXPO_PUBLIC_FLOWEDGE_API_URL=https://<deployment>   # real backend, required
EXPO_PUBLIC_DEMO_MODE=false                          # never true in store builds
```

Screens fetch: `/api/signals/inbox`, `/api/signals/:id`, `/api/scan`, `/api/journal`,
`/api/analytics/*`, `/api/subscription/status`, `/api/notifications/register`.
Fetch failures surface as error states with retry — no sample cards in production.

## Real data API surface

| Endpoint | Purpose |
|---|---|
| `POST /api/webhooks/tradingview` | Real TradingView alert ingestion (secret, Zod, raw log, score, plan, persist, push) |
| `POST /api/webhooks/revenuecat` | Entitlement sync from RevenueCat events |
| `GET /api/signals/active` · `/blocked` · `/inbox` · `/:id` | Persisted signals from Postgres |
| `POST /api/signals/:id/resolve` | Signal lifecycle resolution |
| `GET/POST /api/journal` · `DELETE /api/journal/:id` | Real journal CRUD |
| `GET /api/analytics/overview` · `/by-setup` · `/by-session` | Computed live from stored records |
| `GET /api/settings` · `PUT /api/settings` | Engine settings + real service status |
| `GET /api/subscription/status` · `POST /api/subscription/sync` | Server-side entitlement truth |
| `POST /api/notifications/register` | Expo push token registration |
| `GET /api/scan?full=1` | Server-side engine scan (web pages' data source) |

## Demo/mock code — isolated, opt-in only

| Mock | Location | Reachable when |
|---|---|---|
| Seeded journal (56 trades) | `lib/store/journal.ts` `seedJournal()` | `DEVELOPMENT_DEMO_MODE=true` only |
| In-memory signal ring | `lib/store/signals.ts` | demo mode only |
| Template economic calendar | `lib/data/economic-calendar.ts` | demo mode, dev, or real-provider downtime (logged) |
| Bundled sample signals | `mobile/src/api/sample-signals.ts` | `EXPO_PUBLIC_DEMO_MODE=true` only |
| Mock billing provider | `mobile/src/billing/mock.ts` | Expo Go / demo builds only |
| Synthetic candles | `lib/data/provider.ts` fallback chain | when no market-data key is set (flagged per-pair as `dataSource`) |
