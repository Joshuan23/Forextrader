import { ArrowDownRight, ArrowUpRight, AlertTriangle, Ban, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Direction, Grade, MacroRisk } from '@/lib/engine/types'
import { cn } from '@/lib/utils'

// Color rules: green only for approved bullish, red only for approved
// bearish, amber for caution, gray for blocked. Restrained on purpose.

export function GradeBadge({ grade, className }: { grade: Grade; className?: string }) {
  if (grade === 'blocked') {
    return (
      <Badge variant="muted" className={className}>
        <Ban className="h-3 w-3" /> Blocked
      </Badge>
    )
  }
  if (grade === 'C') {
    return (
      <Badge variant="warn" className={className}>
        <Eye className="h-3 w-3" /> C · Watch
      </Badge>
    )
  }
  return (
    <Badge variant="default" className={className}>
      Grade {grade}
      {grade === 'B' && <span className="font-normal opacity-70">· reduced size</span>}
    </Badge>
  )
}

export function DirectionBadge({
  direction,
  blocked,
  className,
}: {
  direction: Direction
  blocked?: boolean
  className?: string
}) {
  const Icon = direction === 'long' ? ArrowUpRight : ArrowDownRight
  return (
    <Badge variant={blocked ? 'muted' : direction} className={cn('uppercase', className)}>
      <Icon className="h-3 w-3" />
      {direction}
    </Badge>
  )
}

export function EventRiskBadge({ level, className }: { level: MacroRisk; className?: string }) {
  if (level === 'low') {
    return (
      <Badge variant="muted" className={className}>
        Event risk low
      </Badge>
    )
  }
  return (
    <Badge variant={level === 'high' ? 'destructive' : 'warn'} className={className}>
      <AlertTriangle className="h-3 w-3" />
      Event risk {level}
    </Badge>
  )
}

export function ConfidenceMeter({ value, blocked }: { value: number; blocked?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full', blocked ? 'bg-muted-foreground/50' : 'bg-primary')}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </div>
  )
}
