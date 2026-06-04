import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string
  subvalue?: string
  trend?: 'up' | 'down' | 'neutral'
}

export function MetricCard({ label, value, subvalue, trend }: MetricCardProps) {
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  const trendColor =
    trend === 'up'
      ? 'text-[#3fb950]'
      : trend === 'down'
      ? 'text-[#f85149]'
      : 'text-[#8b949e]'

  return (
    <Card className="p-4">
      <p className="text-xs text-[#8b949e] uppercase tracking-wide font-medium mb-2">
        {label}
      </p>
      <p className="text-2xl font-bold text-[#e6edf3] mb-1">{value}</p>
      {subvalue && (
        <div className={cn('flex items-center gap-1 text-sm', trendColor)}>
          {trend && <TrendIcon className="w-3.5 h-3.5" />}
          <span>{subvalue}</span>
        </div>
      )}
    </Card>
  )
}
