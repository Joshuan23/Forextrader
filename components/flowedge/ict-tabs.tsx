'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/ict', label: 'Watch' },
  { href: '/ict/poi', label: 'POI' },
  { href: '/ict/dom', label: 'DOM' },
]

export function IctTabs() {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'flex-1 rounded-md py-1.5 text-center text-sm font-medium transition-colors',
              active ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
