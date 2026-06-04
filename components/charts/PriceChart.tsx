'use client'

import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Candle } from '@/types/forex'
import { format } from 'date-fns'

interface PriceChartProps {
  candles: Candle[]
  height?: number
  digits?: number
}

interface TooltipPayload {
  payload?: {
    time: number
    close: number
    open: number
    high: number
    low: number
    volume: number
  }
}

function CustomTooltip({ payload }: TooltipPayload) {
  if (!payload) return null
  const d = payload
  if (!d.time) return null

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded p-2 text-xs">
      <p className="text-[#8b949e] mb-1">{format(new Date(d.time), 'MMM d, HH:mm')}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="text-[#8b949e]">O:</span>
        <span className="text-[#e6edf3]">{d.open}</span>
        <span className="text-[#8b949e]">H:</span>
        <span className="text-[#3fb950]">{d.high}</span>
        <span className="text-[#8b949e]">L:</span>
        <span className="text-[#f85149]">{d.low}</span>
        <span className="text-[#8b949e]">C:</span>
        <span className="text-[#e6edf3]">{d.close}</span>
      </div>
    </div>
  )
}

export function PriceChart({ candles, height = 300, digits = 4 }: PriceChartProps) {
  const data = candles.slice(-100).map((c) => ({
    time: c.time,
    close: c.close,
    open: c.open,
    high: c.high,
    low: c.low,
    volume: c.volume,
  }))

  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-[#8b949e] text-sm"
      >
        No data available
      </div>
    )
  }

  const firstClose = data[0]?.close ?? 0
  const lastClose = data[data.length - 1]?.close ?? 0
  const isUp = lastClose >= firstClose
  const lineColor = isUp ? '#3fb950' : '#f85149'
  const gradientId = 'priceGradient'

  const minVal = Math.min(...data.map((d) => d.low))
  const maxVal = Math.max(...data.map((d) => d.high))
  const padding = (maxVal - minVal) * 0.1

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={lineColor} stopOpacity={0.2} />
            <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={(val: number) => format(new Date(val), 'HH:mm')}
          tick={{ fill: '#8b949e', fontSize: 11 }}
          axisLine={{ stroke: '#21262d' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minVal - padding, maxVal + padding]}
          tickFormatter={(val: number) => val.toFixed(digits)}
          tick={{ fill: '#8b949e', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip
          content={({ payload }) => {
            if (!payload || payload.length === 0) return null
            const d = payload[0]?.payload as {
              time: number
              close: number
              open: number
              high: number
              low: number
              volume: number
            }
            return <CustomTooltip payload={d} />
          }}
          cursor={{ stroke: '#21262d', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="close"
          stroke={lineColor}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 3, fill: lineColor, stroke: 'none' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
