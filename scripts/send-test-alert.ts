/**
 * Fires a realistic TradingView-style alert at the local webhook so the
 * whole pipeline (auth → Zod → normalize → enrich → score → plan →
 * persist) can be exercised without TradingView.
 *
 *   TRADINGVIEW_WEBHOOK_SECRET=devsecret123 npm run test:webhook
 *   npm run test:webhook -- --blocked   (payload engineered to be blocked)
 */
const base = process.env.FLOWEDGE_URL ?? 'http://localhost:3000'
const secret = process.env.TRADINGVIEW_WEBHOOK_SECRET ?? 'devsecret123'
const wantBlocked = process.argv.includes('--blocked')

const now = Date.now()
const alertPayload = {
  secret,
  source: 'tradingview',
  symbol: 'EURUSD',
  timeframe: '15',
  signalTime: new Date(now).toISOString(),
  setupType: 'trend_pullback',
  direction: 'long',
  mode: 'watchlist',
  close: 1.08425,
  high: 1.08438,
  low: 1.08392,
  atr: 0.00124,
  emaFast: 1.0841,
  emaSlow: 1.0834,
  rsi: 58.2,
  swingHigh: 1.0852,
  swingLow: 1.08295,
  sessionTag: 'london',
  triggerLevel: 1.0841,
  entryCandidate: 1.08425,
  // --blocked: stop absurdly tight → fails the min reward:risk floor
  stopCandidate: wantBlocked ? 1.08421 : 1.08295,
  tpCandidate: 1.0861,
  chartUrl: 'https://www.tradingview.com/chart/?symbol=OANDA:EURUSD',
  timestamp: now,
}

async function main() {
  const res = await fetch(`${base}/api/webhooks/tradingview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alertPayload),
  })
  console.log(`HTTP ${res.status}`)
  console.log(JSON.stringify(await res.json(), null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
