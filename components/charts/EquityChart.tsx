'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/utils'

interface EquityChartProps {
  data: { time: number; value: number }[]
  initialBalance: number
  height?: number
}

export function EquityChart({ data, initialBalance, height = 280 }: EquityChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-[#8b949e] text-sm"
      >
        No equity data
      </div>
    )
  }

  const finalValue = data[data.length - 1]?.value ?? initialBalance
  const isProfit = finalValue >= initialBalance
  const lineColor = isProfit ? '#3fb950' : '#f85149'
  const gradientId = 'equityGradient'

  const minVal = Math.min(...data.map((d) => d.value), initialBalance)
  const maxVal = Math.max(...data.map((d) => d.value), initialBalance)
  const padding = (maxVal - minVal) * 0.1 || 100

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={lineColor} stopOpacity={0.25} />
            <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={(val: number) => format(new Date(val), 'MMM d')}
          tick={{ fill: '#8b949e', fontSize: 11 }}
          axisLine={{ stroke: '#21262d' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minVal - padding, maxVal + padding]}
          tickFormatter={(val: number) => `$${Math.round(val).toLocaleString()}`}
          tick={{ fill: '#8b949e', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={75}
        />
        <Tooltip
          content={({ payload }) => {
            if (!payload || payload.length === 0) return null
            const d = payload[0]?.payload as { time: number; value: number }
            return (
              <div className="bg-[#161b22] border border-[#21262d] rounded p-2 text-xs">
                <p className="text-[#8b949e]">{format(new Date(d.time), 'MMM d, yyyy')}</p>
                <p className="text-[#e6edf3] font-medium">{formatCurrency(d.value)}</p>
                <p
                  className={
                    d.value >= initialBalance ? 'text-[#3fb950]' : 'text-[#f85149]'
                  }
                >
                  {d.value >= initialBalance ? '+' : ''}
                  {formatCurrency(d.value - initialBalance)}
                </p>
              </div>
            )
          }}
          cursor={{ stroke: '#21262d', strokeWidth: 1 }}
        />
        <ReferenceLine
          y={initialBalance}
          stroke="#8b949e"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 3, fill: lineColor, stroke: 'none' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
