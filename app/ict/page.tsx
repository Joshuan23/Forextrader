'use client'

import { useEffect, useState } from 'react'
import { fetchIctWatch, type IctWatchResponse } from '@/lib/client/api'
import { IctWatchList } from '@/components/flowedge/ict-watch'
import { ErrorState, LoadingState } from '@/components/flowedge/data-state'

export default function IctWatchPage() {
  const [data, setData] = useState<IctWatchResponse | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = () => {
    setError(null)
    setData(null)
    fetchIctWatch().then(setData).catch(setError)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">ICT Watch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live sweep → market-structure-shift state for every pair — exactly what the strategy is waiting for right now.
        </p>
      </div>

      {error ? (
        <ErrorState error={error} retry={load} />
      ) : !data ? (
        <LoadingState label="Analyzing every pair…" />
      ) : (
        <>
          <IctWatchList pairs={data.pairs} />
          <p className="text-[11px] leading-5 text-muted-foreground">{data.note}</p>
        </>
      )}
    </div>
  )
}
