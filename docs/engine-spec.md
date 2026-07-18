# FlowEdge Engine Specification — exact formulas

This is the authoritative description of the deterministic logic in `lib/engine/`.

## 0. Determinism guarantee

The engine is a pure function of `(candles, liveRate, clock, settings, journal)`. The mock data
path is also deterministic: simulated candles are aligned to closed-bar boundaries and seeded by
`(pair, timeframe, alignedWindowStart)`, and the simulated live mid is exactly the close of the
last completed bar. Two scans inside the same 15m bar therefore produce byte-identical signals;
output changes only when a bar closes, a calendar event enters/leaves a window, a session
boundary passes, or settings/journal change. Every price level and every layer score carries its
own derivation record — symbolic formula, numeric substitution, and the reason the anchor was
chosen — persisted on the signal and rendered on the signal card.

## 1. Confidence score (0–100)

```
confidence = clamp( Σ layer_score_i × weight_i  +  edge_adjustment , 0, 100 )
```

Default weights (normalised at scoring time; Settings → Signal Weights):

| Layer | Weight | Source |
|---|---|---|
| Technical structure (setup quality) | 0.35 | setup detector quality 0–100 |
| Higher-timeframe alignment | 0.20 | 4H structure + EMA50 agreement |
| Session/liquidity quality | 0.15 | session table below |
| Volatility fit (regime) | 0.10 | regime classifier |
| Event/news safety | 0.10 | macro layer |
| Execution quality | 0.10 | spread/slippage layer |

Grading: `A ≥ 85`, `B 70–84` (reduced size), `C 60–69` (watch only), `< 60` blocked. A grade is
also forced to `blocked` when any hard kill-switch fires (§6).

`edge_adjustment` (journal feedback, keyed by setup×session): `+5` if expectancy ≥ +0.20R over
≥ 10 trades; `−8` if ≤ −0.15R over ≥ 10 trades; hard block if ≤ −0.40R over ≥ 15 trades.

## 2. Layer scores

**Session quality** (UTC windows — Asia 23–08, London 07–16, NY 12–21):
`london_ny_overlap 100 · london 85 · newyork 72 · asia_london_overlap 62 · asia 45 · dead_zone 15`,
0 when the market is closed (Fri 21:00 → Sun 21:00 UTC).

**HTF alignment**: setup direction matches 4H bias → the bias conviction score (88 when 4H
structure and EMA50 agree, 62 when only structure); neutral bias → 50; counter-trend → 28.

**Regime** (15m candles): ATR(14), ADX(14), EMA20/50.
`volatile_expansion` if ATR percentile ≥ 92 and ATR > 1.8× median (score 30);
`trending_up/down` if ADX ≥ 22 with EMA stack aligned (90); `quiet` if ATR percentile ≤ 15 (35);
else `ranging` (62; 85 for mean-reversion setups, 25 for range fades inside trends).

**Event risk**: 0 in blackout; 35 when a high-impact print is < 2h away; 65 on elevated days;
capped at 55 on central-bank days when the downgrade toggle is on; else 100.

**Execution**: start at 100; −10 if spread is 1.1–1.8× typical, −45 if wider; −2 per point of
round-trip cost above 8% of ATR (max −35); −20 × average slippage pips (max −15). Score 10 when
a hard execution block applies.

## 3. Setup detectors (deterministic level math)

All levels are rounded to the pair's tick digits. `ATR` = ATR(14) on the 15m.

**Pullback continuation** (limit): needs HTF bias + 15m retracement 30–78% of the last impulse
`lastLow→lastHigh` (long). Entry = 50% of the impulse; SL = swing low − 0.5·ATR;
TP1 = impulse high; TP2 = high + 0.618 × range; TP3 = high + 1.0 × range. Quality 70 (82 with
order-block confluence).

**Order-block mitigation** (limit): nearest unmitigated OB in bias direction within 2.2·ATR.
Entry = proximal edge; SL = distal edge ± 0.35·ATR; TP1 = 1.5R; TP2 = nearest unswept liquidity
if ≥ 1.8R else 2.5R; TP3 = next liquidity. Quality 80/68/55 by block strength.

**Breakout & retest** (limit): 15m BOS/CHOCH within 12 bars, price within 0.6·ATR of the broken
level. Entry = level; SL = level ∓ 1.0·ATR; TP1 = 1.5R; TP2 = liquidity or 2.4R. Quality 74
(CHOCH) / 66 (BOS).

**Liquidity-sweep reversal** (market): sweep with confirmed rejection within 6 bars. Entry =
current price; SL = sweep extreme ± 0.25·ATR; TP1 = 1.5R; TP2 = opposing liquidity or 2.5R.
Quality 76 aligned / 58 counter-trend. This is the only setup allowed against the HTF bias.

**Range fade** (market): only when HTF is neutral and regime is ranging/quiet; 48-bar range ≥
2.5·ATR and price in the outer 12%. Entry = price; SL = extreme ± 0.5·ATR; TP1 = mid-range;
TP2 = far 15%. Quality 60.

At most **two** setups per pair advance to scoring — fewer signals, higher quality.

## 4. Trade plan & sizing

```
riskPips        = |entry − stop| / pipSize
cost            = spread + expected slippage           (pips)
rr_tp_n         = (rewardPips_n − cost) / (riskPips + cost)     ← net of costs
positionLots    = accountSize × riskPct / (riskPips × pipValuePerLot)
pipValuePerLot  = pipSize × contract            (USD quote)
                = pipSize × contract / price    (USD base)
```

Expiry = 6 signal bars (90 minutes). Management: 50% off at TP1 and stop to entry; remainder to
TP2; optional runner to TP3; time-stop after 6 bars.

## 5. Macro / event layer

Mock calendar mirrors the real cadence (NFP first Friday 12:30 UTC, CPI second Tuesday, FOMC
third Wednesday 18:00, ECB/BoE/BoJ/RBA/BoC weeks, weekly tier-2 data). Blackout = configurable
window (default 30m before / 15m after) around high-impact events for either currency of the
pair. Swap in a real provider behind `fetchCalendarEvents()`.

## 6. Hard kill-switches (any one ⇒ blocked, reasons shown in UI)

1. High-impact event inside the blackout window
2. Spread above the pair/profile limit, or round-trip cost > 25% of ATR
3. ATR below the minimum floor (dead market)
4. ATR above `maxAtrMultiple` × median (panic volatility)
5. Conflicting higher-timeframe bias (except confirmed sweep reversals)
6. Net R:R to TP2 below the configured floor (default 1.5)
7. Session disabled by user filter or outside the active strategy profile
8. Market closed / dead zone
9. Historically toxic setup×session (expectancy ≤ −0.40R over ≥ 15 journaled trades)
10. Confidence below the minimum threshold (default 60)

## 7. Expectancy analytics

```
expectancy(R) = winRate × avgWin(R) − lossRate × |avgLoss(R)|
profitFactor  = grossWins / grossLosses
maxDrawdown   = max peak-to-trough of the cumulative-R curve
stayOutQuality = goodSkips / skippedWithKnownOutcome
```

## 8. Sample trade plan (engine output shape)

```json
{
  "symbol": "EUR/USD",
  "timeframe": "15m",
  "direction": "long",
  "entryType": "limit",
  "setupType": "pullback_continuation",
  "sessionTag": "london",
  "regimeTag": "trending_up",
  "grade": "A",
  "confidence": 88,
  "plan": {
    "entry": 1.08425,
    "stopLoss": 1.08295,
    "takeProfit1": 1.0859,
    "takeProfit2": 1.0874,
    "takeProfit3": 1.08810,
    "riskPips": 13.0,
    "rrTp1": 1.18,
    "riskReward": 2.26,
    "positionSizeLots": 3.85,
    "invalidationLogic": "A 15m close below 1.08280 invalidates the idea before entry. Skip if the spread widens above 1.2p before the fill. Cancel the order if event risk rises into a blackout window."
  },
  "spreadAtSignal": 0.8,
  "atrAtSignal": 0.00124,
  "eventRiskStatus": "low",
  "htfBias": "bullish",
  "status": "approved",
  "expiresAt": "…+90m"
}
```
