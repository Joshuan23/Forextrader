'use client'

import { useEffect, useState } from 'react'
import { Clock, Radio } from 'lucide-react'
import { getSessionInfo } from '@/lib/engine/sessions'
import type { SessionInfo } from '@/lib/engine/types'
import { cn } from '@/lib/utils'

// Sticky top bar: live UTC clock + session state. Session logic is pure
// TypeScript so it runs identically on the client.
export function SessionHeader() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const session: SessionInfo | null = now ? getSessionInfo(now) : null

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/90 px-3 backdrop-blur sm:px-5">
      <div className="flex items-center gap-2 md:hidden">
        <span className="text-sm font-semibold tracking-tight">FlowEdge</span>
      </div>
      {session ? (
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto text-xs sm:gap-3">
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-semibold',
              session.marketOpen ? 'bg-long/15 text-long' : 'bg-muted text-muted-foreground'
            )}
          >
            <Radio className="h-3 w-3" />
            {session.marketOpen ? session.label : 'Market Closed'}
          </span>
          {session.marketOpen && (
            <span className="shrink-0 text-muted-foreground">
              {session.liquidity} liquidity · {session.nextChange}
            </span>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">—</div>
      )}
      <div className="hidden shrink-0 items-center gap-1.5 font-mono text-xs text-muted-foreground sm:flex">
        <Clock className="h-3.5 w-3.5" />
        {now ? now.toISOString().slice(11, 16) : '--:--'} UTC
      </div>
    </header>
  )
}
