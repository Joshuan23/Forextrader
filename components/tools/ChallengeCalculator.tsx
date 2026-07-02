'use client'

import { useState } from 'react'
import { evaluateChallenge, type ChallengeStatus } from '@/lib/proptools/challenge'
import { ACCOUNT_SIZES, CHALLENGE_PRESETS } from '@/lib/proptools/presets'

const inputCls =
  'w-full px-3 py-2.5 bg-[#0f1117] border border-[#21262d] rounded-lg text-[#e6edf3] text-sm focus:outline-none focus:border-[#58a6ff]'
const labelCls = 'block text-xs font-medium text-[#8b949e] mb-1.5'

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_UI: Record<ChallengeStatus, { label: string; cls: string }> = {
  'on-track':       { label: 'On track', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  caution:          { label: 'Caution — reduce risk', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  danger:           { label: 'Danger — close to violation', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  passed:           { label: 'Target reached 🎉', cls: 'bg-[#58a6ff]/15 text-[#58a6ff] border-[#58a6ff]/30' },
  'violated-daily': { label: 'Daily loss limit violated', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  'violated-total': { label: 'Max drawdown violated', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

export function ChallengeCalculator() {
  const [presetId, setPresetId] = useState(CHALLENGE_PRESETS[0].id)
  const [accountSize, setAccountSize] = useState(100_000)
  const [equity, setEquity] = useState(100_000)
  const [dayStartEquity, setDayStartEquity] = useState(100_000)

  const preset = CHALLENGE_PRESETS.find(p => p.id === presetId) ?? CHALLENGE_PRESETS[0]
  const evalResult = evaluateChallenge(
    { accountSize, ...preset.rules },
    { equity, dayStartEquity },
  )
  const status = STATUS_UI[evalResult.status]

  function onAccountSizeChange(size: number) {
    setAccountSize(size)
    setEquity(size)
    setDayStartEquity(size)
  }

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>Challenge type</label>
          <select value={presetId} onChange={e => setPresetId(e.target.value)} className={inputCls}>
            {CHALLENGE_PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Account size (USD)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {ACCOUNT_SIZES.map(size => (
              <button
                key={size}
                type="button"
                onClick={() => onAccountSizeChange(size)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  accountSize === size
                    ? 'bg-[#58a6ff]/15 text-[#58a6ff] border-[#58a6ff]/40'
                    : 'bg-[#0f1117] text-[#8b949e] border-[#21262d] hover:text-[#e6edf3]'
                }`}
              >
                ${size.toLocaleString('en-US')}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            value={accountSize}
            onChange={e => setAccountSize(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Current equity (USD)</label>
          <input
            type="number"
            min={0}
            value={equity}
            onChange={e => setEquity(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Equity at start of today (USD)</label>
          <input
            type="number"
            min={0}
            value={dayStartEquity}
            onChange={e => setDayStartEquity(Number(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-[#21262d] space-y-4">
        <div className={`inline-flex items-center px-3 py-1.5 rounded-full border text-sm font-medium ${status.cls}`}>
          {status.label}
        </div>

        {preset.rules.profitTargetPct > 0 && (
          <div>
            <div className="flex justify-between text-xs text-[#8b949e] mb-1">
              <span>Progress to target (${fmt(evalResult.targetEquity)})</span>
              <span>{evalResult.progressPct.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-[#0f1117] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#58a6ff] rounded-full transition-all"
                style={{ width: `${evalResult.progressPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="bg-[#0f1117] border border-[#21262d] rounded-lg p-4">
            <div className="text-xs text-[#8b949e] mb-1">Room before daily violation</div>
            <div className="text-lg font-bold text-[#e6edf3]">${fmt(evalResult.remainingDaily)}</div>
            <div className="text-xs text-[#484f58] mt-1">Floor: ${fmt(evalResult.dailyLossFloor)}</div>
          </div>
          <div className="bg-[#0f1117] border border-[#21262d] rounded-lg p-4">
            <div className="text-xs text-[#8b949e] mb-1">Room before max drawdown</div>
            <div className="text-lg font-bold text-[#e6edf3]">${fmt(evalResult.remainingTotal)}</div>
            <div className="text-xs text-[#484f58] mt-1">Floor: ${fmt(evalResult.totalLossFloor)}</div>
          </div>
          <div className="bg-[#0f1117] border border-[#21262d] rounded-lg p-4">
            <div className="text-xs text-[#8b949e] mb-1">Suggested max risk / trade</div>
            <div className="text-lg font-bold text-[#3fb950]">${fmt(evalResult.suggestedRiskUsd)}</div>
            <div className="text-xs text-[#484f58] mt-1">Survives 3 straight losses</div>
          </div>
        </div>

        <p className="text-xs text-[#484f58]">
          The {evalResult.bindingLimit === 'daily' ? 'daily loss limit' : 'max drawdown'} is currently
          your binding constraint. Rules vary by firm — always verify against your firm&apos;s official
          dashboard.
        </p>
      </div>
    </div>
  )
}
