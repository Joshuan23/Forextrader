import { analyzeIctState } from '../lib/backtest/ict'
import type { Candle } from '../types/forex'
function synth(bars: number, seed = 1): Candle[] {
  const out: Candle[] = []; let price = 1.085; let t = Date.UTC(2026, 6, 20, 7, 0)
  for (let i = 0; i < bars; i++) {
    const r = Math.sin(i * 0.7 + seed) * 0.5 + Math.sin(i * 0.13) * 0.5
    const o = price; let c = o + r * 0.0004
    const hunt = i % 47 === 0
    const w = hunt ? 0.0012 : 0.0004
    const hi = Math.max(o, c) + w, lo = Math.min(o, c) - w
    price = c
    out.push({ time: t, open: o, high: hi, low: lo, close: c, volume: 100 }); t += 15 * 60_000
  }
  return out
}
for (const seed of [1, 2, 3]) {
  const s = analyzeIctState(synth(400, seed))
  console.log(`seed=${seed}: bias=${s.bias} htf=${s.htfBias} kz=${s.killZone} sweep=${s.sweepLevel?.toFixed(5) ?? '—'} mss=${s.mssTarget?.toFixed(5) ?? '—'} conf=${s.confluenceScore} [${s.confirmationsReady.join(',')}]`)
  // sanity: armed states must have both levels; neutral must have none
  const ok = s.bias === 'neutral' ? (s.sweepLevel === null && s.mssTarget === null) : (s.sweepLevel !== null && s.mssTarget !== null)
  if (!ok) { console.error('INCONSISTENT STATE', s); process.exit(1) }
}
console.log('ICT STATE SMOKE PASS')
