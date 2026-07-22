'use client'

import type { IctWatchPair } from '@/lib/client/api'

const BIAS_STYLE: Record<string, { label: string; cls: string }> = {
  armed_long: { label: 'ARMED LONG', cls: 'bg-long/15 text-long border-long/30' },
  armed_short: { label: 'ARMED SHORT', cls: 'bg-short/15 text-short border-short/30' },
  neutral: { label: 'WAITING', cls: 'bg-muted text-muted-foreground border-border' },
}

function KillZoneBadge({ zone, active }: { zone?: string; active?: boolean }) {
  if (!zone) return null
  const label = zone === 'london' ? 'London KZ' : zone === 'newyork' ? 'New York KZ' : 'Off-session'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
      {label}
    </span>
  )
}

export function IctWatchList({ pairs }: { pairs: IctWatchPair[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pairs.map((p) => {
        if (p.status && p.status !== 'ok') {
          return (
            <div key={p.symbol} className="rounded-lg border bg-card p-4">
              <div className="font-mono text-sm font-semibold">{p.symbol}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {p.status === 'insufficient_data' ? 'Not enough candle history to analyze.' : `Unavailable: ${p.status}`}
              </div>
            </div>
          )
        }
        const bias = BIAS_STYLE[p.bias ?? 'neutral'] ?? BIAS_STYLE.neutral
        return (
          <div key={p.symbol} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-mono text-sm font-semibold">{p.symbol}</div>
                <div className="text-[11px] text-muted-foreground">{p.name}</div>
              </div>
              <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${bias.cls}`}>{bias.label}</span>
            </div>

            <p className="mt-3 text-xs leading-5 text-foreground">{p.waitingFor}</p>

            {p.bias !== 'neutral' && p.entry != null && (
              <div className="mt-3 rounded-md border border-border bg-background/50 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Projected trade plan
                  </span>
                  {p.riskReward != null && (
                    <span className="text-[11px] font-semibold text-primary">{p.riskReward}R</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Plan label="Entry" value={p.entry} />
                  <Plan label="Stop" value={p.stopLoss} tone="short" />
                  <Plan label="Target" value={p.takeProfit} tone="long" />
                </div>
                {p.riskPips != null && (
                  <div className="mt-1.5 text-center text-[10px] text-muted-foreground">
                    Risk {p.riskPips} pips · fills on the 15m MSS close
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              <Row label="Last" value={p.lastClose != null ? String(p.lastClose) : '—'} />
              <Row label="HTF bias" value={(p.htfBias ?? 'neutral').toUpperCase()} accent={p.htfBias === 'up' ? 'long' : p.htfBias === 'down' ? 'short' : undefined} />
              {p.sweepLevel != null && <Row label="Swept" value={String(p.sweepLevel)} />}
              {p.mssTarget != null && <Row label="MSS trigger" value={`${p.mssTarget}${p.pipsToTarget != null ? ` (${p.pipsToTarget}p)` : ''}`} />}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {(p.confluencesReady ?? []).length > 0 ? (
                  p.confluencesReady!.map((c) => (
                    <span key={c} className="rounded bg-long/10 px-1.5 py-0.5 text-[10px] text-long">✓ {c}</span>
                  ))
                ) : (
                  <span className="text-[10px] text-muted-foreground">No confluences yet</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {p.bias !== 'neutral' && <span className="text-[11px] font-semibold text-foreground">{p.confluenceScore}/5</span>}
                <KillZoneBadge zone={p.killZone} active={p.inKillZone} />
              </div>
            </div>

            {p.liquidity && (p.liquidity.above.length > 0 || p.liquidity.below.length > 0) && (
              <div className="mt-3 border-t border-border pt-2.5">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Order-book liquidity (DOM)
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-[11px]">
                  <LiquidityCol label="Above (buy-side)" side="short" pools={p.liquidity.above} />
                  <LiquidityCol label="Below (sell-side)" side="long" pools={p.liquidity.below} />
                </div>
                {p.drawOnLiquidity && (
                  <p className="mt-1.5 text-[10px] leading-4 text-primary">→ {p.drawOnLiquidity}</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Plan({ label, value, tone }: { label: string; value?: number | null; tone?: 'long' | 'short' }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-mono text-xs font-semibold ${tone === 'long' ? 'text-long' : tone === 'short' ? 'text-short' : 'text-foreground'}`}>
        {value ?? '—'}
      </div>
    </div>
  )
}

function LiquidityCol({
  label,
  side,
  pools,
}: {
  label: string
  side: 'long' | 'short'
  pools: { price: number; percent: number }[]
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      {pools.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">—</div>
      ) : (
        pools.map((b) => (
          <div key={b.price} className="flex items-center justify-between">
            <span className={`font-mono ${side === 'long' ? 'text-long' : 'text-short'}`}>{b.price}</span>
            <span className="text-muted-foreground">{b.percent}%</span>
          </div>
        ))
      )}
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: 'long' | 'short' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${accent === 'long' ? 'text-long' : accent === 'short' ? 'text-short' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}
