'use client'

import { useEffect, useState } from 'react'
import { fetchOrderBook, type OrderBookResponse, type ExchangeOrderBook, type OrderBookLevel } from '@/lib/client/api'
import { ErrorState, LoadingState } from '@/components/flowedge/data-state'
import { cn } from '@/lib/utils'

export default function OrderBookPage() {
  const [symbol, setSymbol] = useState('XAU/USD')
  const [data, setData] = useState<OrderBookResponse | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = (sym: string) => {
    setError(null)
    fetchOrderBook(sym).then(setData).catch(setError)
  }
  useEffect(() => {
    load(symbol)
    const t = setInterval(() => load(symbol), 5000) // live-ish: refresh every 5s
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol])

  const book = data?.book
  const instruments = data?.instruments ?? [
    { symbol: 'XAU/USD', venueSymbol: 'PAXG/USD', label: 'Gold' },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Order Book</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live central limit order book — real resting bids &amp; asks from the exchange.
        </p>
      </div>

      {/* Instrument selector */}
      <div className="flex flex-wrap gap-1.5">
        {instruments.map((it) => (
          <button
            key={it.symbol}
            type="button"
            onClick={() => { setData(null); setSymbol(it.symbol) }}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              symbol === it.symbol
                ? 'border-primary bg-secondary text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {it.symbol}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} retry={() => load(symbol)} />
      ) : !book ? (
        <LoadingState label="Loading live order book…" />
      ) : (
        <Book book={book} note={data?.note} />
      )}
    </div>
  )
}

function Book({ book, note }: { book: ExchangeOrderBook; note?: string }) {
  const fmt = (x: number) => x.toLocaleString(undefined, { maximumFractionDigits: x < 10 ? 4 : 2 })
  const asksTopDown = [...book.asks].reverse() // show asks high→low so mid sits in the middle
  return (
    <div className="space-y-3">
      {/* Header: venue, mid, spread */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
        <div>
          <div className="text-sm font-semibold">{book.label}</div>
          <div className="text-[11px] text-muted-foreground">{book.venue} · {book.venueSymbol}</div>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Mid</div>
            <div className="font-mono text-sm font-semibold">{fmt(book.mid)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Spread</div>
            <div className="font-mono text-sm font-semibold">{fmt(book.spread)} <span className="text-muted-foreground">({book.spreadPct}%)</span></div>
          </div>
        </div>
      </div>

      {/* Ladder */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-3 border-b px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <div>Price</div>
          <div className="text-right">Size</div>
          <div className="text-right">Total</div>
        </div>
        {/* Asks (sell side) */}
        <div>
          {asksTopDown.map((lvl, i) => (
            <Row key={`a${i}`} lvl={lvl} maxTotal={book.maxTotal} side="ask" fmt={fmt} />
          ))}
        </div>
        {/* Mid divider */}
        <div className="flex items-center justify-between border-y bg-background/60 px-3 py-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">Spread</span>
          <span className="font-mono text-sm font-semibold">{fmt(book.mid)}</span>
        </div>
        {/* Bids (buy side) */}
        <div>
          {book.bids.map((lvl, i) => (
            <Row key={`b${i}`} lvl={lvl} maxTotal={book.maxTotal} side="bid" fmt={fmt} />
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-5 text-muted-foreground">{note}</p>
    </div>
  )
}

function Row({
  lvl,
  maxTotal,
  side,
  fmt,
}: {
  lvl: OrderBookLevel
  maxTotal: number
  side: 'bid' | 'ask'
  fmt: (x: number) => string
}) {
  const pct = maxTotal > 0 ? Math.min(100, (lvl.total / maxTotal) * 100) : 0
  const bid = side === 'bid'
  return (
    <div className="relative grid grid-cols-3 px-3 py-1 text-xs">
      {/* depth bar grows from the price side */}
      <div
        className={cn('absolute inset-y-0 right-0', bid ? 'bg-long/10' : 'bg-short/10')}
        style={{ width: `${pct}%` }}
        aria-hidden
      />
      <div className={cn('relative z-10 font-mono font-semibold', bid ? 'text-long' : 'text-short')}>{fmt(lvl.price)}</div>
      <div className="relative z-10 text-right font-mono text-foreground">{fmt(lvl.size)}</div>
      <div className="relative z-10 text-right font-mono text-muted-foreground">{fmt(lvl.total)}</div>
    </div>
  )
}
