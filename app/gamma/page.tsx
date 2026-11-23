'use client'

import { useEffect, useState } from 'react'
import { fetchGamma, type GexResponse, type Gex, type GexStrike } from '@/lib/client/api'
import { ErrorState, LoadingState } from '@/components/flowedge/data-state'
import { cn } from '@/lib/utils'

const QUICK = ['SPY', 'QQQ', 'IWM', 'AAPL', 'TSLA', 'NVDA']

export default function GammaPage() {
  const [symbol, setSymbol] = useState('SPY')
  const [input, setInput] = useState('SPY')
  const [expiry, setExpiry] = useState<number | undefined>(undefined)
  const [data, setData] = useState<GexResponse | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = (sym: string, exp?: number) => {
    setError(null)
    fetchGamma(sym, exp).then(setData).catch(setError)
  }
  useEffect(() => {
    setData(null)
    load(symbol, expiry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, expiry])

  const pick = (s: string) => { setExpiry(undefined); setInput(s); setSymbol(s) }
  const gex = data?.gex

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Gamma</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dealer gamma exposure (GEX) by strike — walls, flip level, and net positioning.
        </p>
      </div>

      {/* Symbol picker */}
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => pick(s)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
              symbol === s ? 'border-primary bg-secondary text-primary' : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {s}
          </button>
        ))}
        <form
          onSubmit={(e) => { e.preventDefault(); if (input.trim()) pick(input.trim().toUpperCase()) }}
          className="flex items-center gap-1"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ticker"
            className="w-20 rounded-md border border-border bg-card px-2 py-1 text-xs uppercase outline-none focus:border-primary"
          />
          <button type="submit" className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">Go</button>
        </form>
      </div>

      {error ? (
        <ErrorState error={error} retry={() => load(symbol, expiry)} />
      ) : !gex ? (
        <LoadingState label="Loading options chain & computing GEX…" />
      ) : (
        <GexView gex={gex} note={data?.note} expiry={expiry} onExpiry={setExpiry} />
      )}
    </div>
  )
}

function money(x: number): string {
  const sign = x > 0 ? '+' : x < 0 ? '−' : ''
  const a = Math.abs(x)
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`
  return `${sign}$${Math.round(a)}`
}

function GexView({
  gex,
  note,
  expiry,
  onExpiry,
}: {
  gex: Gex
  note?: string
  expiry?: number
  onExpiry: (u: number) => void
}) {
  // Insert a spot marker between the two strikes it sits between.
  const rows = gex.strikes
  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Spot" value={gex.spot.toLocaleString()} />
        <Stat label="Net GEX" value={money(gex.netGex)} tone={gex.netGex >= 0 ? 'long' : 'short'} />
        <Stat label="Call wall Γ" value={gex.callWall?.toLocaleString() ?? '—'} tone="long" />
        <Stat label="Put wall Γ" value={gex.putWall?.toLocaleString() ?? '—'} tone="short" />
      </div>

      {/* Expiry + flip line */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={expiry ?? gex.expiries[0]?.unix ?? ''}
          onChange={(e) => onExpiry(Number(e.target.value))}
          className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium outline-none"
        >
          {gex.expiries.map((ex) => (
            <option key={ex.unix} value={ex.unix}>Exp {ex.label}</option>
          ))}
        </select>
        <div className="text-[11px] text-muted-foreground">
          Flip level <span className="font-mono font-semibold text-amber-500">{gex.flip?.toLocaleString() ?? '—'}</span>
          {gex.flip != null && (
            <span className="ml-1">· {gex.spot > gex.flip ? 'above (pinning)' : 'below (unstable)'}</span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-long" /> Call GEX (dealer long gamma)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-short" /> Put GEX (dealer short gamma)</span>
      </div>

      {/* Strike ladder */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Strike</span>
          <span>Exp {gex.expiryLabel} · Net GEX</span>
        </div>
        {rows.map((r, i) => {
          const next = rows[i + 1]
          const spotHere = next && gex.spot <= r.strike && gex.spot > next.strike
          return (
            <div key={r.strike}>
              <StrikeRow r={r} maxAbs={gex.maxAbs} isCallWall={r.strike === gex.callWall} isPutWall={r.strike === gex.putWall} />
              {spotHere && (
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-0.5">
                  <div className="h-px flex-1 bg-primary/60" />
                  <span className="font-mono text-[10px] font-semibold text-primary">SPOT {gex.spot.toLocaleString()}</span>
                  <div className="h-px flex-1 bg-primary/60" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] leading-5 text-muted-foreground">{note}</p>
    </div>
  )
}

function StrikeRow({ r, maxAbs, isCallWall, isPutWall }: { r: GexStrike; maxAbs: number; isCallWall: boolean; isPutWall: boolean }) {
  const pct = Math.min(100, (Math.abs(r.netGex) / maxAbs) * 100)
  const pos = r.netGex >= 0
  const wall = isCallWall || isPutWall
  return (
    <div className="relative flex items-center justify-between px-3 py-1 text-xs">
      <div className={cn('absolute inset-y-0 left-0', pos ? 'bg-long/15' : 'bg-short/15')} style={{ width: `${pct}%` }} aria-hidden />
      <span className={cn('relative z-10 font-mono', wall ? 'font-bold text-foreground' : 'text-muted-foreground')}>
        {wall && <span className="mr-1">{isCallWall ? '👑' : '⚠︎'}</span>}
        {r.strike.toLocaleString()}
      </span>
      <span className={cn('relative z-10 font-mono font-semibold', pos ? 'text-long' : 'text-short')}>{money(r.netGex)}</span>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'long' | 'short' }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('font-mono text-sm font-semibold', tone === 'long' ? 'text-long' : tone === 'short' ? 'text-short' : 'text-foreground')}>{value}</div>
    </div>
  )
}
