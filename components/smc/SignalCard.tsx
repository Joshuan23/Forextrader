'use client'

import type { SMCSignal } from '@/types/smc'
import { formatPrice } from '@/lib/utils'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

interface SignalCardProps {
  signal: SMCSignal
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function SignalCard({ signal }: SignalCardProps) {
  const pairConfig = CURRENCY_PAIRS.find((p) => p.symbol === signal.pair)
  const digits = pairConfig?.digits ?? 5

  const isBuy = signal.direction === 'buy'

  const borderColor =
    signal.confidence === 'high'
      ? 'border-l-emerald-500'
      : signal.confidence === 'medium'
      ? 'border-l-amber-500'
      : 'border-l-red-500'

  const confidenceColor =
    signal.confidence === 'high'
      ? 'text-emerald-400 bg-emerald-500/20'
      : signal.confidence === 'medium'
      ? 'text-amber-400 bg-amber-500/20'
      : 'text-red-400 bg-red-500/20'

  const scoreColor =
    signal.score >= 65
      ? 'bg-emerald-500'
      : signal.score >= 40
      ? 'bg-amber-500'
      : 'bg-red-500'

  const tp1 = signal.takeProfits[0]
  const extraTPs = signal.takeProfits.slice(1)

  return (
    <div
      className={`bg-[#161b22] border border-[#21262d] border-l-4 ${borderColor} rounded-lg p-4 space-y-3`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* BUY/SELL badge with pulse dot */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-bold text-sm ${
            isBuy
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              isBuy ? 'bg-emerald-400' : 'bg-red-400'
            }`}
          />
          {isBuy ? 'BUY' : 'SELL'}
        </span>

        {/* Pair */}
        <span className="text-[#e6edf3] font-semibold">{signal.pair}</span>

        {/* Timeframe */}
        <span className="text-xs text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded">
          {signal.timeframe}
        </span>

        {/* Confidence */}
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${confidenceColor}`}>
          {signal.confidence.toUpperCase()}
        </span>

        {/* Time ago */}
        <span className="ml-auto text-xs text-[#8b949e]">{timeAgo(signal.timestamp)}</span>
      </div>

      {/* Score bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-[#8b949e]">
          <span>Confluence Score</span>
          <span className="text-[#e6edf3] font-medium">{signal.score}/100</span>
        </div>
        <div className="w-full bg-[#21262d] rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${scoreColor}`}
            style={{ width: `${signal.score}%` }}
          />
        </div>
      </div>

      {/* Price levels grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Entry */}
        <div className="bg-[#21262d] rounded p-2 text-center">
          <div className="text-xs text-[#8b949e] mb-0.5">ENTRY</div>
          <div className="text-sm font-mono font-semibold text-blue-400">
            {formatPrice(signal.entry, digits)}
          </div>
        </div>

        {/* Stop Loss */}
        <div className="bg-[#21262d] rounded p-2 text-center">
          <div className="text-xs text-[#8b949e] mb-0.5">STOP LOSS</div>
          <div className="text-sm font-mono font-semibold text-red-400">
            {formatPrice(signal.stopLoss, digits)}
          </div>
          <div className="text-xs text-red-400/70">{signal.riskPips.toFixed(1)} pips</div>
        </div>

        {/* TP1 */}
        {tp1 && (
          <div className="bg-[#21262d] rounded p-2 text-center">
            <div className="text-xs text-[#8b949e] mb-0.5">TP1</div>
            <div className="text-sm font-mono font-semibold text-emerald-400">
              {formatPrice(tp1.price, digits)}
            </div>
            <div className="text-xs text-emerald-400/70">R:R {tp1.rr.toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Additional TP levels */}
      {extraTPs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {extraTPs.map((tp) => (
            <span
              key={tp.label}
              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded border border-emerald-500/20"
            >
              <span className="font-medium">{tp.label}</span>
              <span className="text-[#8b949e]">•</span>
              <span className="font-mono">{formatPrice(tp.price, digits)}</span>
              <span className="text-emerald-400/60">({tp.rr.toFixed(2)}R)</span>
            </span>
          ))}
        </div>
      )}

      {/* Confluence list */}
      {signal.triggers.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-[#8b949e] font-medium">CONFLUENCE</div>
          <ul className="space-y-0.5">
            {signal.triggers.map((trigger, idx) => (
              <li key={idx} className="flex items-center gap-1.5 text-xs text-[#c9d1d9]">
                <span className="text-emerald-400 font-bold">✓</span>
                {trigger}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
