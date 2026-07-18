'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { CHART } from '@/lib/chart-colors'
import type { Candle } from '@/types/forex'

export interface ChartLevel {
  price: number
  label: string
  kind: 'entry' | 'stop' | 'target' | 'level'
}

const LEVEL_STYLE: Record<ChartLevel['kind'], { stroke: string; dash?: string }> = {
  entry: { stroke: CHART.line },
  stop: { stroke: CHART.neg, dash: '4 3' },
  target: { stroke: CHART.pos, dash: '4 3' },
  level: { stroke: CHART.axis, dash: '2 4' },
}

// Structure map: close-price line on the signal timeframe with the trade
// plan's exact levels and key structural levels overlaid.
export function StructureChart({
  candles,
  digits,
  levels = [],
}: {
  candles: Candle[]
  digits: number
  levels?: ChartLevel[]
}) {
  const data = candles.slice(-140).map((c) => ({
    time: c.time,
    close: c.close,
  }))
  if (data.length === 0) return null

  const closes = data.map((d) => d.close)
  const levelPrices = levels.map((l) => l.price)
  const min = Math.min(...closes, ...levelPrices)
  const max = Math.max(...closes, ...levelPrices)
  const pad = (max - min) * 0.06 || 0.0005

  return (
    <div className="h-64 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 64, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={(t: number) => new Date(t).toISOString().slice(11, 16)}
            stroke={CHART.axis}
            tick={{ fontSize: 10, fill: CHART.axis }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            minTickGap={48}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            orientation="right"
            stroke={CHART.axis}
            tick={{ fontSize: 10, fill: CHART.axis, fontFamily: 'ui-monospace, monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v.toFixed(digits)}
            width={62}
          />
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
            contentStyle={{
              background: CHART.surface,
              border: `1px solid ${CHART.grid}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(t) => new Date(Number(t)).toUTCString().slice(5, 22) + ' UTC'}
            formatter={(value) => [Number(value).toFixed(digits), 'Close']}
          />
          {levels.map((l, i) => {
            const s = LEVEL_STYLE[l.kind]
            return (
              <ReferenceLine
                key={`${l.label}-${i}`}
                y={l.price}
                stroke={s.stroke}
                strokeDasharray={s.dash}
                strokeWidth={1.25}
                label={{
                  value: l.label,
                  position: 'insideTopLeft',
                  fill: s.stroke,
                  fontSize: 10,
                }}
              />
            )
          })}
          <Line
            type="monotone"
            dataKey="close"
            stroke={CHART.line}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
