# FlowEdge — Institutional FX Decision Engine

FlowEdge generates institutional-style forex trade plans — exact entry, stop, TP1/TP2(/TP3), a
0–100 confidence score, and explicit **NO TRADE** output when conditions are poor. It is a
disciplined decision engine, not a signal toy: no signal fires without contextual validation
across six layers (structure, higher-timeframe bias, volatility regime, session/liquidity,
macro/event risk, execution quality), and a journal-driven expectancy loop feeds realised
performance back into live scoring.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui-style components · Prisma 7 +
PostgreSQL (optional — full mock fallback) · Recharts · Zod · server actions.

## Quick start

```bash
npm install
npx prisma generate
npm run dev          # http://localhost:3000 — runs fully on mock data
```

Optional — real persistence and data:

```bash
cp .env.local.example .env.local
# set DATABASE_URL, then:
npx prisma db push   # create schema
npx tsx prisma/seed.ts
# set ALPHA_VANTAGE_API_KEY for real candles (Yahoo/Frankfurter are keyless fallbacks)
```

## Architecture

```
lib/
  engine/          the decision engine (pure TypeScript, no I/O except engine.ts)
    config.ts      spec constants: weights 35/20/15/10/10/10, grades 85/70/60, blackouts
    sessions.ts    UTC session clock: Asia/London/NY/overlaps/dead zone + quality scores
    events.ts      macro layer: blackouts, central-bank days, macro risk level
    regime.ts      ADX/ATR-percentile regime classifier (volatility fit)
    structure.ts   HTF bias + 5 setup detectors with deterministic level math
    execution.ts   spread/slippage layer: live spread vs limits, cost as % of ATR
    scoring.ts     weighted 0–100 confidence + hard kill-switches + grading
    planner.ts     trade plan: sizing, cost-adjusted R:R, invalidation, plain-English text
    profiles.ts    strategy profiles (London breakout, NY continuation, …)
    feedback.ts    journal expectancy → live confidence adjustment / hard block
    expectancy.ts  analytics math (expectancy, drawdown, stay-out quality, cost drag)
    engine.ts      orchestrator: evaluatePair / scanMarket
  data/            swappable providers (Yahoo → Alpha Vantage → Frankfurter → simulated;
                   mock economic calendar behind fetchCalendarEvents)
  store/           settings + journal repositories: Prisma when DATABASE_URL is set,
                   seeded in-memory stores otherwise
app/
  dashboard/ signals/ pairs/[symbol]/ journal/ analytics/ settings/
  api/scan/        full engine output as JSON
  actions/         server actions (journal CRUD, settings)
prisma/schema.prisma   Pair, Candle, EconomicEvent, Signal, TradePlan, JournalEntry,
                       ExecutionMetric, PairSessionStats, UserSettings, StrategyProfile
```

Scoring formulas, level math, and kill-switch rules are documented in
[`docs/engine-spec.md`](docs/engine-spec.md).

## Product rules

- Grades: **A ≥ 85** (full size) · **B 70–84** (reduced size) · **C 60–69** (watch only) ·
  **< 60 blocked**.
- Hard kill-switches override any score: news blackout, spread above limit, ATR floor/ceiling,
  conflicting HTF bias (unless a confirmed liquidity-sweep reversal), R:R below the configured
  floor (default 1.5R net of costs), disabled sessions, weekend/dead zone, historically toxic
  setup/session combos.
- Every plan is explainable in plain English and carries invalidation logic.
