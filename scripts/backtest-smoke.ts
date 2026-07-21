// Smoke-drive of the ICT backtest engine on synthetic candles:
// 30 days of 15m bars with trends, stop-hunt wicks, and reversals so the
// sweep→MSS machine has real work to do. Verifies it runs, produces trades,
// and that per-trade outcomes are internally consistent.
import { runIctBacktest } from '../lib/backtest/ict'
import type { Candle } from '../types/forex'

function synth(bars: number): Candle[] {
  const out: Candle[] = []
  let price = 1.085
  let t = Date.UTC(2026, 5, 1) // June 1 2026 00:00 UTC
  let phase = 0
  for (let i = 0; i < bars; i++) {
    phase = Math.floor(i / 160) % 4 // regime rotates every ~1.7 days
    const drift = phase === 0 ? 0.00003 : phase === 2 ? -0.00003 : 0
    const vol = phase === 1 || phase === 3 ? 0.0006 : 0.0004
    const r1 = Math.sin(i * 0.7) * 0.5 + Math.sin(i * 0.13) * 0.5
    const r2 = Math.cos(i * 1.9) * 0.5
    const open = price
    let close = open + drift + r1 * vol * 0.6
    // Periodic stop-hunt bar: long wick beyond recent range then close back
    const hunt = i % 53 === 0
    const wick = hunt ? vol * 2.2 : vol * (0.6 + Math.abs(r2))
    const high = Math.max(open, close) + (r2 > 0 ? wick : wick * 0.3)
    const low = Math.min(open, close) - (r2 > 0 ? wick * 0.3 : wick)
    // Occasional displacement bar to trigger MSS with body
    if (i % 37 === 0) close = open + (r1 > 0 ? 1 : -1) * vol * 2.5
    price = close
    out.push({ time: t, open, high: Math.max(high, open, close), low: Math.min(low, open, close), close, volume: 100 })
    t += 15 * 60_000
  }
  return out
}

const candles = synth(2880) // 30 days of 15m
for (const minConfl of [2, 3, 4]) {
  const r = runIctBacktest(candles, { minConfl, requireFvg: false, useHtfBias: false, killOnly: true })
  console.log(`minConfl=${minConfl}: trades=${r.overall.trades} wins=${r.overall.wins} losses=${r.overall.losses} timeouts=${r.overall.timeouts} winRate=${(r.overall.winRate * 100).toFixed(1)}% expectancy=${r.overall.expectancyR.toFixed(2)}R PF=${r.overall.profitFactor.toFixed(2)} maxDD=${r.maxDrawdownR}R`)
  console.log('  byConfluence:', JSON.stringify(r.byConfluence))
}

// Consistency checks
const r = runIctBacktest(candles, { minConfl: 1, requireFvg: false, useHtfBias: false, killOnly: false })
let bad = 0
for (const t of r.trades) {
  const risk = Math.abs(t.entry - t.stop)
  if (risk <= 0) { console.error('BAD: zero risk', t); bad++ }
  if (t.direction === 'long' && !(t.stop < t.entry && t.target > t.entry)) { console.error('BAD long levels', t); bad++ }
  if (t.direction === 'short' && !(t.stop > t.entry && t.target < t.entry)) { console.error('BAD short levels', t); bad++ }
  if (t.outcome === 'loss' && t.rMultiple !== -1) { console.error('BAD loss R', t); bad++ }
  if (t.outcome === 'win' && t.rMultiple < 1.9) { console.error('BAD win R below minRR', t); bad++ }
  if (t.confluenceScore !== t.confirmations.length) { console.error('BAD confluence count', t); bad++ }
}
console.log(`\nkillOnly=false minConfl=1: ${r.trades.length} trades, consistency violations: ${bad}`)
console.log(bad === 0 ? 'SMOKE TEST PASS' : 'SMOKE TEST FAIL')
