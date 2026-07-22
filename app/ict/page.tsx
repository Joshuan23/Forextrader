'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { fetchIctWatch, type IctWatchResponse } from '@/lib/client/api'
import { IctWatchList } from '@/components/flowedge/ict-watch'
import { IctTabs } from '@/components/flowedge/ict-tabs'
import { ErrorState, LoadingState } from '@/components/flowedge/data-state'

const REFRESH_MS = 60_000

export default function IctWatchPage() {
  const [data, setData] = useState<IctWatchResponse | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  // background=true keeps the current board visible while re-fetching.
  const load = useCallback((background = false) => {
    if (background) setRefreshing(true)
    else {
      setError(null)
      setData(null)
    }
    fetchIctWatch()
      .then((d) => {
        setData(d)
        setError(null)
        setUpdatedAt(new Date())
      })
      .catch((e) => {
        if (!background) setError(e)
      })
      .finally(() => setRefreshing(false))
  }, [])

  // Initial load + 60s auto-refresh; pauses while the tab is hidden.
  useEffect(() => {
    load()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ICT Watch</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live sweep → market-structure-shift state for every pair — exactly what the strategy is waiting for right now.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Refresh now"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {updatedAt ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Refresh'}
        </button>
      </div>

      <IctTabs />

      {error ? (
        <ErrorState error={error} retry={() => load()} />
      ) : !data ? (
        <LoadingState label="Analyzing every pair…" />
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-long" />
            Auto-refreshing every 60s
          </div>
          <IctWatchList pairs={data.pairs} />
          <p className="text-[11px] leading-5 text-muted-foreground">{data.note}</p>
        </>
      )}
    </div>
  )
}
