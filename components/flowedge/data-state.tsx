'use client'

import { AlertTriangle, Database } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ApiError } from '@/lib/client/api'

// Shared loading / error / empty states for real-data pages.
// Setup errors (503 from the server) render the actual remediation text —
// the app fails loudly and explains itself instead of showing fake data.

export function LoadingState({ label = 'Loading live data…' }: { label?: string }) {
  return <div className="text-sm text-muted-foreground">{label}</div>
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const isSetup = error instanceof ApiError && error.setup
  const message =
    error instanceof Error ? error.message : 'Something went wrong loading live data.'
  return (
    <Card className="border-destructive/40">
      <CardContent className="flex items-start gap-3 p-4">
        {isSetup ? (
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        )}
        <div className="space-y-1">
          <div className="text-sm font-semibold text-destructive">
            {isSetup ? 'Configuration required' : 'Live data unavailable'}
          </div>
          <p className="text-sm text-muted-foreground">{message}</p>
          {retry && (
            <button onClick={retry} className="text-sm font-medium text-primary hover:underline">
              Retry
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm font-medium">{title}</div>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
