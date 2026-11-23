'use client'

import { useEffect, useState } from 'react'
import {
  fetchOrderBook,
  fetchOrderBookInstruments,
  type OrderBookResponse,
  type InstrumentGroup,
  type ExchangeOrderBook,
  type OrderBookLevel,
} from '@/lib/client/api'
import { ErrorState, LoadingState } from '@/components/flowedge/data-state'
import { cn } from '@/lib/utils'

export default function OrderBookPage() {
  const [groups, setGroups] = useState<InstrumentGroup[] | null>(null)
  const [groupsError, setGroupsError] = useState<unknown>(null)
  const [symbol, setSymbol] = useState<string>('')
  const [data, setData] = useState<OrderBookResponse | null>(null)
  const [error, setError] = useState<unknown>(null)

  // Load the grouped instrument list once, then default to the first available.
  useEffect(() => {
    fetchOrderBookInstruments()
      .then((r) => {
        setGroups(r.groups)
        const all = r.groups.flatMap((g) => g.instruments)
        const preferred = all.find((i) => i.symbol === 'XAU/USD') ?? all.find((i) => i.symbol === 'BTC/USD') ?? all[0]
        if (preferred) setSymbol(preferred.symbol)
      })
      .catch(setGroupsError)
  }, [])

  // Load + live-refresh the book for the selected symbol.
  useEffect(() => {
    if (!symbol) return
    const load = () => fetchOrderBook(symbol).then(setData).catch(setError)
    setError(null)
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [symbol])

  const book = data?.book

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Order Book</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live central limit order book — real resting bids &amp; asks from the exchange.
        </p>
      </div>

      {/* Category dropdowns */}
      {groupsError ? (
        <ErrorState error={groupsError} retry={() => location.reload()} />
      ) : !groups ? (
        <div className="text-xs text-muted-foreground">Loading instruments…</div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {groups.map((g) => (
            <CategorySelect key={g.category} group={g} active={symbol} onPick={(s) => { setData(null); setSymbol(s) }} />
          ))}
        </div>
      )}

      {/* Book */}
      {!symbol ? null : error ? (
        <ErrorState error={error} retry={() => fetchOrderBook(symbol).then(setData).catch(setError)} />
      ) : !book ? (
        <LoadingState label="Loading live order book…" />
      ) : (
        <Book book={book} note={data?.note} />
      )}
    </div>
  )
}

function CategorySelect({
  group,
  active,
  onPick,
}: {
  group: InstrumentGroup
  active: string
  onPick: (symbol: string) => void
}) {
  const hasActive = group.instruments.some((i) => i.symbol === active)
  const empty = group.instruments.length === 0
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group.category}</span>
      <select
        value={hasActive ? active : ''}
        disabled={empty}
        onChange={(e) => e.target.value && onPick(e.target.value)}
        className={cn(
          'w-full rounded-md border bg-card px-2.5 py-1.5 text-sm font-medium outline-none transition-colors',
          hasActive ? 'border-primary text-primary' : 'border-border text-foreground',
          empty && 'cursor-not-allowed opacity-50'
        )}
      >
        <option value="">{empty ? 'None available' : `Select ${group.category.toLowerCase()}…`}</option>
        {group.instruments.map((i) => (
          <option key={i.symbol} value={i.symbol}>
            {i.symbol} — {i.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Book({ book, note }: { book: ExchangeOrderBook; note?: string }) {
  const fmt = (x: number) => x.toLocaleString(undefined, { maximumFractionDigits: x < 10 ? 4 : 2 })
  const asksTopDown = [...book.asks].reverse()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
        <div>
          <div className="text-sm font-semibold">{book.label}</div>
          <div className="text-[11px] text-muted-foreground">{book.venue} · {book.venueSymbol} · {book.category}</div>
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

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-3 border-b px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <div>Price</div>
          <div className="text-right">Size</div>
          <div className="text-right">Total</div>
        </div>
        <div>
          {asksTopDown.map((lvl, i) => (
            <Row key={`a${i}`} lvl={lvl} maxTotal={book.maxTotal} side="ask" fmt={fmt} />
          ))}
        </div>
        <div className="flex items-center justify-between border-y bg-background/60 px-3 py-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">Spread</span>
          <span className="font-mono text-sm font-semibold">{fmt(book.mid)}</span>
        </div>
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
