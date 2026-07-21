import { getCandles } from '@/lib/data/provider'
import { generateIctEntries } from '@/lib/backtest/ict'
import { ingestTradingViewAlert } from '@/lib/engine/ingest'
import { saveSignal } from '@/lib/store/signals'
import type { NormalizedAlert } from '@/lib/schemas/tradingview'
import type { FlowEdgeSettings } from '@/lib/engine/types'
import type { JournalRecord } from '@/lib/engine/expectancy'
import type { Timeframe } from '@/types/forex'

// Server-side ICT scanner — the same sweep→MSS→confluence strategy as the
// Pine feeder and the backtester, run directly on live candles so ICT
// signals flow through the app WITHOUT TradingView. Each scheduled scan:
//   1. pulls recent 15m candles per whitelisted pair
//   2. replays the ICT state machine (generateIctEntries — identical code
//      path the backtest measures, so live behavior matches the stats)
//   3. takes only entries on the FRESHEST closed bars (no stale re-emits;
//      deterministic ids make re-scans idempotent via upsert)
//   4. feeds them through the full context pipeline (session, news,
//      spread, execution, expectancy) → grade → persist → push

const TF: Timeframe = '15m'
const TF_MS = 15 * 60_000
const CANDLE_COUNT = 400 // ≥200 bars for the 1h EMA50 HTF bias + pivots
// A cron running every 15m sees 1–2 new bars; accept entries this fresh.
const FRESH_BARS = 2

export interface IctScanSummary {
  pairsScanned: number
  detected: number
  approved: number
  blocked: number
  pushed: number
  errors: string[]
}

export async function scanIctSetups(
  settings: FlowEdgeSettings,
  journal: JournalRecord[],
  now = Date.now()
): Promise<IctScanSummary> {
  const summary: IctScanSummary = { pairsScanned: 0, detected: 0, approved: 0, blocked: 0, pushed: 0, errors: [] }

  for (const symbol of settings.pairWhitelist) {
    try {
      const { candles } = await getCandles(symbol, TF, CANDLE_COUNT)
      if (candles.length < 250) continue // not enough history for HTF bias
      summary.pairsScanned++

      const entries = generateIctEntries(candles)
      const lastTime = candles[candles.length - 1].time
      const fresh = entries.filter((e) => lastTime - e.time <= (FRESH_BARS - 1) * TF_MS)

      for (const e of fresh) {
        summary.detected++
        const alert: NormalizedAlert = {
          symbol,
          timeframe: TF,
          tvSetupType: 'liquidity_sweep',
          setupType: 'liquidity_sweep_reversal',
          direction: e.direction,
          mode: 'watchlist',
          close: e.close,
          high: e.high,
          low: e.low,
          atr: e.atr,
          emaFast: e.emaFast,
          emaSlow: e.emaSlow,
          rsi: e.rsi,
          swingHigh: e.swingHigh,
          swingLow: e.swingLow,
          triggerLevel: e.triggerLevel,
          entryCandidate: e.entry,
          stopCandidate: e.stop,
          tpCandidate: e.target,
          confluenceScore: e.confluenceScore,
          confirmations: e.confirmations.join(','),
          barTime: e.time,
          signalTime: e.time,
        }

        const signal = await ingestTradingViewAlert(alert, settings, journal, now, {
          source: 'ict-scanner',
          idPrefix: 'ict',
        })
        await saveSignal(signal)
        if (signal.status === 'approved') {
          summary.approved++
          try {
            const { notifyApprovedSignal } = await import('@/lib/services/notifications')
            const push = await notifyApprovedSignal(signal)
            summary.pushed += push.sent
          } catch {
            // push failures never fail the scan
          }
        } else {
          summary.blocked++
        }
      }
    } catch (err) {
      summary.errors.push(`${symbol}: ${err instanceof Error ? err.message : 'scan failed'}`)
    }
  }

  return summary
}
