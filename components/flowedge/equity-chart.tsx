'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { CHART } from '@/lib/chart-colors'

// Cumulative R equity curve from journal entries (single series).
export function EquityChart({ points }: { points: { time: number; equityR: number }[] }) {
  if (points.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">No closed trades yet.</div>
  }
  const data = points.map((p) => ({ ...p }))

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.line} stopOpacity={0.25} />
              <stop offset="100%" stopColor={CHART.line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={(t: number) => new Date(t).toISOString().slice(5, 10)}
            stroke={CHART.axis}
            tick={{ fontSize: 10, fill: CHART.axis }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            minTickGap={40}
          />
          <YAxis
            stroke={CHART.axis}
            tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'ui-monospace, monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}R`}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
            contentStyle={{
              background: CHART.surface,
              border: `1px solid ${CHART.grid}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(t) => new Date(Number(t)).toISOString().slice(0, 10)}
            formatter={(value) => [`${Number(value).toFixed(2)}R`, 'Equity']}
          />
          <ReferenceLine y={0} stroke={CHART.axis} strokeDasharray="2 4" />
          <Area
            type="monotone"
            dataKey="equityR"
            stroke={CHART.line}
            strokeWidth={2}
            fill="url(#eqFill)"
            dot={false}
            activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
