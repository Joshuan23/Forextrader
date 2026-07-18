# TradingView → FlowEdge Integration

The hybrid pipeline: **TradingView detects technical setups; FlowEdge decides.** The Pine
feeder ships chart-native context as JSON; the app validates it, enriches it with the
macro/session/volatility/execution/expectancy layers, scores it 0–100, generates the exact
trade plan, persists it, and answers with the decision — including `NO TRADE` (`blocked`).

```
TradingView chart ──(alert webhook, JSON)──▶ POST /api/webhooks/tradingview
  Pine v6 feeder                               │ 1. rate limit (30/min/IP)
  · trend pullback                             │ 2. secret check (timing-safe)
  · breakout continuation                      │ 3. raw payload logged (secret redacted)
  · range rejection                            │ 4. Zod validation + sanitizing
  · session breakout                           │ 5. normalize symbol/timeframe/setup
                                               │ 6. enrich: session · events · regime ·
                                               │    spread/slippage · HTF bias · edge
                                               │ 7. score (35/20/15/10/10/10) + kill-switches
                                               │ 8. exact trade plan + derivations
                                               │ 9. persist Signal + TradePlan
                                               ▼
                              JSON decision  ◀─┘   → Signals page “TradingView Inbox”
                                                   → POST /api/signals/:id/resolve
```

## 1. Install the Pine feeder

1. TradingView → Pine Editor → paste `pine/flowedge-signal-feeder.pine` → Add to chart
   (5m or 15m on EURUSD/GBPUSD/USDJPY/AUDUSD/USDCAD, optionally XAUUSD).
2. In the indicator settings set **Webhook secret** to the same value as
   `TRADINGVIEW_WEBHOOK_SECRET` in your `.env.local`.
3. Create an alert: condition = *FlowEdge Signal Feeder* → **Any alert() function call**;
   leave the message box unchanged; Notifications → Webhook URL:
   `https://<your-app>/api/webhooks/tradingview`.
4. Mode `watchlist` (informational) or `automation` (tagged for future broker routing).

The script only sends chart-native facts (price, EMA, ATR, RSI, swings, session tag,
candidate levels). It deliberately knows nothing about macro events, broker spreads, or
expectancy — that context is applied server-side.

## 2. Sample alert payload (what Pine sends)

```json
{
  "secret": "MY_SECRET",
  "source": "tradingview",
  "symbol": "EURUSD",
  "timeframe": "15",
  "signalTime": "2026-07-18T00:40:00Z",
  "setupType": "trend_pullback",
  "direction": "long",
  "mode": "watchlist",
  "close": 1.08425, "high": 1.08438, "low": 1.08392,
  "atr": 0.00124, "emaFast": 1.08410, "emaSlow": 1.08340, "rsi": 58.2,
  "swingHigh": 1.08520, "swingLow": 1.08295,
  "sessionTag": "london", "triggerLevel": 1.08410,
  "entryCandidate": 1.08425, "stopCandidate": 1.08295, "tpCandidate": 1.08610,
  "chartUrl": "https://www.tradingview.com/chart/?symbol=OANDA:EURUSD",
  "timestamp": 1784335200000
}
```

## 3. Sample responses

Approved (HTTP 200):

```json
{
  "ok": true, "decision": "approved", "signalId": "tv-EURUSD-trend_pullback-1784335200000",
  "pair": "EUR/USD", "direction": "long", "grade": "B", "confidenceScore": 78, "approved": true,
  "entry": 1.08425, "stopLoss": 1.08264, "takeProfit1": 1.08586, "takeProfit2": 1.08812,
  "riskRewardToTp1": 0.93, "riskRewardToTp2": 2.26, "positionSizeLots": 3.1,
  "sessionTag": "london", "regimeTag": "trending_up", "htfBias": "bullish",
  "eventRiskStatus": "low", "executionQuality": "good", "spreadAtSignal": 0.2,
  "historicalEdgeBoost": 0, "blockedReasons": [],
  "invalidationRule": "A 15m close below 1.08295 (the chart's invalidation swing) kills the idea before entry. Skip if the spread widens above 1.2p before the fill. Cancel the order if event risk rises into a blackout window.",
  "explanation": "Long EUR/USD — Pullback Continuation (grade B, confidence 78/100). …",
  "expiresAt": "2026-07-18T02:10:00.000Z"
}
```

Blocked / NO TRADE (still HTTP 200 — a rejection is a successful decision):

```json
{
  "ok": true, "decision": "blocked", "approved": false, "grade": "blocked",
  "confidenceScore": 71,
  "blockedReasons": [
    "Net reward:risk to TP2 is 0.84R — below the 1.5R floor after spread and slippage"
  ],
  "entry": 1.08425, "stopLoss": 1.0842, "takeProfit1": 1.0843, "takeProfit2": 1.08435
}
```

Errors: `400 invalid_json` · `401 unauthorized` (bad secret) · `422 validation_failed` ·
`429 rate_limited` · `503` when the server secret is unconfigured. Every inbound payload is
stored in `RawWebhookLog` (secret redacted) for debugging.

## 4. Resolving outcomes

```
POST /api/signals/:id/resolve
{ "outcome": "hit_tp1" }   // hit_tp1 | hit_tp2 | stopped | cancelled | expired | invalid
```

Also available from the Signals page (TradingView Inbox → Resolve buttons). Resolved
outcomes feed the journal/expectancy loop that adjusts future scoring.

## 5. Level math applied to chart candidates

- `stop = stopCandidate ∓ 0.25 × ATR(chart)` — buffer beyond the chart's invalidation.
- `TP1 = swing extreme` if it lies in `[0.8R, 1.6R]`, else `entry ± 1.0R`.
- `TP2 = tpCandidate` if `≥ 1.6R`, else app-side unswept liquidity `≥ 1.6R`, else `entry ± 2.4R`.
- `TP3 = entry ± 3.5R` on trend setups only.
- Technical quality: base `trend_pullback 72 · breakout_continuation 68 · session_breakout 66 ·
  range_rejection 62`, `+6` EMA alignment, `+4` RSI band, capped at 85.
- Then the standard weighted score (35/20/15/10/10/10), hard kill-switches (blackout, spread,
  ATR floor/ceiling, conflicting HTF bias, min R:R, sessions, staleness > 3 bars), and the
  historical-edge adjustment (+5 / −8 / block).

## 6. Local testing without TradingView

```bash
TRADINGVIEW_WEBHOOK_SECRET=devsecret123 npm run dev
npm run test:webhook              # approved-path sample alert
npm run test:webhook -- --blocked # engineered to fail the R:R floor
```
