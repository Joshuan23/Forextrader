'use client'

import { useEffect, useState } from 'react'
import { fetchDom, type DomResponse, type DomBook } from '@/lib/client/api'
import { IctTabs } from '@/components/flowedge/ict-tabs'
import { ErrorState, LoadingState } from '@/components/flowedge/data-state'

export default function DomPage() {
  const [data, setData] = useState<DomResponse | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = () => {
    setError(null)
    setData(null)
    fetchDom().then(setData).catch(setError)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Depth of Market</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          OANDA order-book &amp; position-book liquidity — where resting orders and open positions cluster.
        </p>
      </div>

      <IctTabs />

      {error ? (
        <ErrorState error={error} retry={load} />
      ) : !data ? (
        <LoadingState label="Reading order books…" />
      ) : !data.oandaConfigured ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {data.note}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data.pairs.map((p) => {
              const hasData = (p.orderBook && (p.orderBook.above.length || p.orderBook.below.length)) ||
                (p.positionBook && (p.positionBook.above.length || p.positionBook.below.length))
              return (
                <div key={p.symbol} className="rounded-lg border bg-card p-4">
                  <div className="flex items-baseline justify-between">
                    <div className="font-mono text-sm font-semibold">{p.symbol}</div>
                    <div className="text-[11px] text-muted-foreground">{p.price != null ? `@ ${p.price}` : ''}</div>
                  </div>
                  {!hasData ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {p.error ? `Unavailable: ${p.error}` : 'No order-book data for this instrument.'}
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <Book title="Order Book (resting orders + stops)" book={p.orderBook} />
                      <Book title="Position Book (open positions)" book={p.positionBook} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">{data.note}</p>
        </>
      )}
    </div>
  )
}

function Book({ title, book }: { title: string; book?: DomBook | null }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {!book ? (
        <div className="text-[11px] text-muted-foreground">—</div>
      ) : (
        <div className="space-y-2 text-[11px]">
          <Side label="Above (buy-side liquidity)" tone="short" rows={book.above} />
          <Side label="Below (sell-side liquidity)" tone="long" rows={book.below} />
        </div>
      )}
    </div>
  )
}

function Side({ label, tone, rows }: { label: string; tone: 'long' | 'short'; rows: { price: number; percent: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.percent))
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      {rows.length === 0 ? (
        <div className="text-muted-foreground">—</div>
      ) : (
        rows.map((r) => (
          <div key={r.price} className="flex items-center gap-2">
            <span className={`w-16 shrink-0 font-mono ${tone === 'long' ? 'text-long' : 'text-short'}`}>{r.price}</span>
            <span className="relative h-3 flex-1 overflow-hidden rounded bg-muted">
              <span
                className={`absolute inset-y-0 left-0 ${tone === 'long' ? 'bg-long/40' : 'bg-short/40'}`}
                style={{ width: `${(r.percent / max) * 100}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right text-muted-foreground">{r.percent}%</span>
          </div>
        ))
      )}
    </div>
  )
}
