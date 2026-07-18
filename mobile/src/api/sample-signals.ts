// Bundled sample signals for mock mode — generated from the REAL FlowEdge
// engine (docs/sample-signals.json): a grade-A approval, a grade-B, the same
// setup downgraded to C in Asia, and an NFP-blackout block.
import type { MobileSignal } from './types'

export const SAMPLE_SIGNALS: MobileSignal[] = [
  {
    "id": "fe-USDCAD-liquidity_sweep_reversal-1784350800000",
    "pair": "USD/CAD",
    "timeframe": "15m",
    "direction": "short",
    "setupType": "liquidity_sweep_reversal",
    "entryType": "market",
    "grade": "A",
    "confidence": 87,
    "status": "approved",
    "session": "london_ny_overlap",
    "regime": "ranging",
    "htfBias": "bearish",
    "eventRisk": "low",
    "spreadPips": 0.4,
    "entry": 1.3666,
    "stopLoss": 1.3682,
    "takeProfit1": 1.3642,
    "takeProfit2": 1.3626,
    "takeProfit3": null,
    "rrTp1": 1.42,
    "rrTp2": 2.39,
    "confidenceEquation": "0.35\u00d776 + 0.20\u00d788 + 0.10\u00d785 + 0.15\u00d7100 + 0.10\u00d797 + 0.10\u00d7100 = 87.4 \u2192 87",
    "blockReasons": [],
    "invalidation": "A second sweep of 1.3680 without reclaim means the level is being run \u2014 the reversal premise is dead. Skip if the spread widens above 2.0p before the fill. Cancel the order if event risk rises into a blackout window.",
    "explanation": "confirmed sweep base 76; counter-trend against 4H bias \u2192 \u221218 \u21d2 76 (aligned, no deduction) short aligned with bearish 4H bias \u2192 conviction score 88 (4H structure bearish (LH/LL) AND close < 4H EMA50 (1.37957) \u2192 bias bearish, conviction 88)",
    "layerScores": [
      {
        "label": "Technical Structure",
        "score": 76,
        "rule": "confirmed sweep base 76; counter-trend against 4H bias \u2192 \u221218 \u21d2 76 (aligned, no deduction)"
      },
      {
        "label": "Higher-TF Bias",
        "score": 88,
        "rule": "short aligned with bearish 4H bias \u2192 conviction score 88 (4H structure bearish (LH/LL) AND close < 4H EMA50 (1.37957) \u2192 bias bearish, conviction 88)"
      },
      {
        "label": "Volatility / Regime",
        "score": 85,
        "rule": "ADX 16.1 < 22 (or EMAs mixed), ATR P95 in 16\u201391 \u2192 ranging \u2192 62; mean-reversion setup in a range \u2192 override 85"
      },
      {
        "label": "Session / Liquidity",
        "score": 100,
        "rule": "session table: overlap 100 \u00b7 london 85 \u00b7 newyork 72 \u00b7 asia/lon 62 \u00b7 asia 45 \u00b7 dead 15; now london_ny_overlap \u2192 100"
      },
      {
        "label": "Execution Quality",
        "score": 97,
        "rule": "100 \u2212 0 (spread 0.4p = tight) \u2212 0 (cost 6% of ATR, penalty 2\u00d7max(0,6\u22128) cap 35) \u2212 2.8 (slippage 0.14p \u00d7 20, cap 15) = 97"
      },
      {
        "label": "Macro / Event Risk",
        "score": 100,
        "rule": "no qualifying events \u2192 100 = 100"
      }
    ],
    "derivations": [
      {
        "level": "Entry",
        "value": 1.3666,
        "formula": "close of confirmation bar (market)",
        "computation": "= 1.3666"
      },
      {
        "level": "Stop",
        "value": 1.3682,
        "formula": "sweepExtreme + 0.25 \u00d7 ATR",
        "computation": "1.3680 + 0.25 \u00d7 0.0009 = 1.3682"
      },
      {
        "level": "TP1",
        "value": 1.3642,
        "formula": "entry \u2212 1.5 \u00d7 risk",
        "computation": "1.3666 \u2212 1.5 \u00d7 0.0016 = 1.3642"
      },
      {
        "level": "TP2",
        "value": 1.3626,
        "formula": "entry \u2212 2.5 \u00d7 risk",
        "computation": "1.3666 \u2212 2.5 \u00d7 0.0016 = 1.3626"
      }
    ],
    "createdAt": 0,
    "expiresAt": 0
  },
  {
    "id": "fe-USDJPY-pullback_continuation-1784350800000",
    "pair": "USD/JPY",
    "timeframe": "15m",
    "direction": "long",
    "setupType": "pullback_continuation",
    "entryType": "limit",
    "grade": "B",
    "confidence": 81,
    "status": "approved",
    "session": "london_ny_overlap",
    "regime": "trending_up",
    "htfBias": "bullish",
    "eventRisk": "low",
    "spreadPips": 0.3,
    "entry": 144.136,
    "stopLoss": 143.923,
    "takeProfit1": 144.286,
    "takeProfit2": 144.471,
    "takeProfit3": 144.586,
    "rrTp1": 0.67,
    "rrTp2": 1.52,
    "confidenceEquation": "0.35\u00d770 + 0.20\u00d762 + 0.10\u00d790 + 0.15\u00d7100 + 0.10\u00d796 + 0.10\u00d7100 = 80.5 \u2192 81",
    "blockReasons": [],
    "invalidation": "A 15m close below 143.986 (the swing low that anchors this leg) invalidates the idea before entry. Skip if the spread widens above 1.5p before the fill. Cancel the order if event risk rises into a blackout window.",
    "explanation": "base 70 (valid pullback, fib 30\u201378%), no order-block confluence long aligned with bullish 4H bias \u2192 conviction score 62 (4H structure bullish but close < EMA50 (142.49563) disagrees \u2192 bias bullish, conviction 62)",
    "layerScores": [
      {
        "label": "Technical Structure",
        "score": 70,
        "rule": "base 70 (valid pullback, fib 30\u201378%), no order-block confluence"
      },
      {
        "label": "Higher-TF Bias",
        "score": 62,
        "rule": "long aligned with bullish 4H bias \u2192 conviction score 62 (4H structure bullish but close < EMA50 (142.49563) disagrees \u2192 bias bullish, conviction 62)"
      },
      {
        "label": "Volatility / Regime",
        "score": 90,
        "rule": "ADX 35.6 \u2265 22 with EMA20/50 aligned \u2192 trending \u2192 90"
      },
      {
        "label": "Session / Liquidity",
        "score": 100,
        "rule": "session table: overlap 100 \u00b7 london 85 \u00b7 newyork 72 \u00b7 asia/lon 62 \u00b7 asia 45 \u00b7 dead 15; now london_ny_overlap \u2192 100"
      },
      {
        "label": "Execution Quality",
        "score": 96,
        "rule": "100 \u2212 0 (spread 0.3p = tight) \u2212 0 (cost 4% of ATR, penalty 2\u00d7max(0,4\u22128) cap 35) \u2212 3.6 (slippage 0.18p \u00d7 20, cap 15) = 96"
      },
      {
        "label": "Macro / Event Risk",
        "score": 100,
        "rule": "no qualifying events \u2192 100 = 100"
      }
    ],
    "derivations": [
      {
        "level": "Entry",
        "value": 144.136,
        "formula": "swingHigh \u2212 0.50 \u00d7 leg",
        "computation": "144.286 \u2212 0.50 \u00d7 0.300 = 144.136"
      },
      {
        "level": "Stop",
        "value": 143.923,
        "formula": "swingLow \u2212 0.50 \u00d7 ATR",
        "computation": "143.986 \u2212 0.50 \u00d7 0.127 = 143.923"
      },
      {
        "level": "TP1",
        "value": 144.286,
        "formula": "swingHigh",
        "computation": "= 144.286"
      },
      {
        "level": "TP2",
        "value": 144.471,
        "formula": "swingHigh + 0.618 \u00d7 leg",
        "computation": "144.286 + 0.618 \u00d7 0.300 = 144.471"
      },
      {
        "level": "TP3",
        "value": 144.586,
        "formula": "swingHigh + 1.00 \u00d7 leg",
        "computation": "144.286 + 1.00 \u00d7 0.300 = 144.586"
      }
    ],
    "createdAt": 0,
    "expiresAt": 0
  },
  {
    "id": "fe-USDJPY-pullback_continuation-1784350800000",
    "pair": "USD/JPY",
    "timeframe": "15m",
    "direction": "long",
    "setupType": "pullback_continuation",
    "entryType": "limit",
    "grade": "C",
    "confidence": 68,
    "status": "approved",
    "session": "asia",
    "regime": "trending_up",
    "htfBias": "bullish",
    "eventRisk": "medium",
    "spreadPips": 0.3,
    "entry": 144.136,
    "stopLoss": 143.923,
    "takeProfit1": 144.286,
    "takeProfit2": 144.471,
    "takeProfit3": 144.586,
    "rrTp1": 0.66,
    "rrTp2": 1.5,
    "confidenceEquation": "0.35\u00d770 + 0.20\u00d762 + 0.10\u00d790 + 0.15\u00d745 + 0.10\u00d794 + 0.10\u00d755 = 67.5 \u2192 68",
    "blockReasons": [],
    "invalidation": "A 15m close below 143.986 (the swing low that anchors this leg) invalidates the idea before entry. Skip if the spread widens above 1.5p before the fill. Cancel the order if event risk rises into a blackout window.",
    "explanation": "base 70 (valid pullback, fib 30\u201378%), no order-block confluence long aligned with bullish 4H bias \u2192 conviction score 62 (4H structure bullish but close < EMA50 (142.49563) disagrees \u2192 bias bullish, conviction 62)",
    "layerScores": [
      {
        "label": "Technical Structure",
        "score": 70,
        "rule": "base 70 (valid pullback, fib 30\u201378%), no order-block confluence"
      },
      {
        "label": "Higher-TF Bias",
        "score": 62,
        "rule": "long aligned with bullish 4H bias \u2192 conviction score 62 (4H structure bullish but close < EMA50 (142.49563) disagrees \u2192 bias bullish, conviction 62)"
      },
      {
        "label": "Volatility / Regime",
        "score": 90,
        "rule": "ADX 35.6 \u2265 22 with EMA20/50 aligned \u2192 trending \u2192 90"
      },
      {
        "label": "Session / Liquidity",
        "score": 45,
        "rule": "session table: overlap 100 \u00b7 london 85 \u00b7 newyork 72 \u00b7 asia/lon 62 \u00b7 asia 45 \u00b7 dead 15; now asia \u2192 45"
      },
      {
        "label": "Execution Quality",
        "score": 94,
        "rule": "100 \u2212 0 (spread 0.3p = tight) \u2212 0 (cost 5% of ATR, penalty 2\u00d7max(0,5\u22128) cap 35) \u2212 5.8 (slippage 0.29p \u00d7 20, cap 15) = 94"
      },
      {
        "label": "Macro / Event Risk",
        "score": 55,
        "rule": "medium risk (CB day, high-impact \u2264 8h, or medium-impact \u00b160m) \u2192 65; central-bank day cap \u2192 min(score, 55) = 55"
      }
    ],
    "derivations": [
      {
        "level": "Entry",
        "value": 144.136,
        "formula": "swingHigh \u2212 0.50 \u00d7 leg",
        "computation": "144.286 \u2212 0.50 \u00d7 0.300 = 144.136"
      },
      {
        "level": "Stop",
        "value": 143.923,
        "formula": "swingLow \u2212 0.50 \u00d7 ATR",
        "computation": "143.986 \u2212 0.50 \u00d7 0.127 = 143.923"
      },
      {
        "level": "TP1",
        "value": 144.286,
        "formula": "swingHigh",
        "computation": "= 144.286"
      },
      {
        "level": "TP2",
        "value": 144.471,
        "formula": "swingHigh + 0.618 \u00d7 leg",
        "computation": "144.286 + 0.618 \u00d7 0.300 = 144.471"
      },
      {
        "level": "TP3",
        "value": 144.586,
        "formula": "swingHigh + 1.00 \u00d7 leg",
        "computation": "144.286 + 1.00 \u00d7 0.300 = 144.586"
      }
    ],
    "createdAt": 0,
    "expiresAt": 0
  },
  {
    "id": "fe-EURUSD-liquidity_sweep_reversal-1784350800000",
    "pair": "EUR/USD",
    "timeframe": "15m",
    "direction": "long",
    "setupType": "liquidity_sweep_reversal",
    "entryType": "market",
    "grade": "blocked",
    "confidence": 70,
    "status": "blocked",
    "session": "london_ny_overlap",
    "regime": "trending_up",
    "htfBias": "neutral",
    "eventRisk": "high",
    "spreadPips": 0.2,
    "entry": 1.1312,
    "stopLoss": 1.1303,
    "takeProfit1": 1.1325,
    "takeProfit2": 1.1334,
    "takeProfit3": null,
    "rrTp1": 1.35,
    "rrTp2": 2.31,
    "confidenceEquation": "0.35\u00d776 + 0.20\u00d750 + 0.10\u00d790 + 0.15\u00d7100 + 0.10\u00d797 + 0.10\u00d70 = 70.3 \u2192 70",
    "blockReasons": [
      "US Non-Farm Payrolls (USD) in 15m \u2014 inside 30m pre-news blackout"
    ],
    "invalidation": "A second sweep of 1.1305 without reclaim means the level is being run \u2014 the reversal premise is dead. Skip if the spread widens above 1.2p before the fill. Cancel the order if event risk rises into a blackout window.",
    "explanation": "confirmed sweep base 76; counter-trend against 4H bias \u2192 \u221218 \u21d2 76 (aligned, no deduction) 4H bias neutral \u2192 50",
    "layerScores": [
      {
        "label": "Technical Structure",
        "score": 76,
        "rule": "confirmed sweep base 76; counter-trend against 4H bias \u2192 \u221218 \u21d2 76 (aligned, no deduction)"
      },
      {
        "label": "Higher-TF Bias",
        "score": 50,
        "rule": "4H bias neutral \u2192 50"
      },
      {
        "label": "Volatility / Regime",
        "score": 90,
        "rule": "ADX 45 \u2265 22 with EMA20/50 aligned \u2192 trending \u2192 90"
      },
      {
        "label": "Session / Liquidity",
        "score": 100,
        "rule": "session table: overlap 100 \u00b7 london 85 \u00b7 newyork 72 \u00b7 asia/lon 62 \u00b7 asia 45 \u00b7 dead 15; now london_ny_overlap \u2192 100"
      },
      {
        "label": "Execution Quality",
        "score": 97,
        "rule": "100 \u2212 0 (spread 0.2p = tight) \u2212 0 (cost 5% of ATR, penalty 2\u00d7max(0,5\u22128) cap 35) \u2212 3.4 (slippage 0.17p \u00d7 20, cap 15) = 97"
      },
      {
        "label": "Macro / Event Risk",
        "score": 0,
        "rule": "inside blackout window (30m before / 15m after high-impact) \u2192 0"
      }
    ],
    "derivations": [
      {
        "level": "Entry",
        "value": 1.1312,
        "formula": "close of confirmation bar (market)",
        "computation": "= 1.1312"
      },
      {
        "level": "Stop",
        "value": 1.1303,
        "formula": "sweepExtreme \u2212 0.25 \u00d7 ATR",
        "computation": "1.1305 \u2212 0.25 \u00d7 0.0007 = 1.1303"
      },
      {
        "level": "TP1",
        "value": 1.1325,
        "formula": "entry + 1.5 \u00d7 risk",
        "computation": "1.1312 + 1.5 \u00d7 0.0009 = 1.1325"
      },
      {
        "level": "TP2",
        "value": 1.1334,
        "formula": "entry + 2.5 \u00d7 risk",
        "computation": "1.1312 + 2.5 \u00d7 0.0009 = 1.1334"
      }
    ],
    "createdAt": 0,
    "expiresAt": 0
  }
]

export function rebasedSamples(now = Date.now()): MobileSignal[] {
  return SAMPLE_SIGNALS.map((s, i) => ({
    ...s,
    createdAt: now - (i + 1) * 25 * 60 * 1000,
    expiresAt: now + 90 * 60 * 1000,
  }))
}
