'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { evaluateChallenge, type ChallengeRules, type ChallengeStatus } from '@/lib/proptools/challenge'
import { ACCOUNT_SIZES, CHALLENGE_PRESETS } from '@/lib/proptools/presets'

const STORAGE_KEY = 'fxt_challenge'

interface ChallengeConfig {
  presetId: string
  rules: ChallengeRules
  equity: number
  dayStartEquity: number
  dayStamp: string // YYYY-MM-DD of the last "trading day start"
}

function defaultConfig(): ChallengeConfig {
  return {
    presetId: CHALLENGE_PRESETS[0].id,
    rules: { accountSize: 100_000, ...CHALLENGE_PRESETS[0].rules },
    equity: 100_000,
    dayStartEquity: 100_000,
    dayStamp: new Date().toISOString().slice(0, 10),
  }
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const inputCls =
  'w-full px-3 py-2.5 bg-[#0f1117] border border-[#21262d] rounded-lg text-[#e6edf3] text-sm focus:outline-none focus:border-[#58a6ff]'
const labelCls = 'block text-xs font-medium text-[#8b949e] mb-1.5'

const STATUS_UI: Record<ChallengeStatus, { label: string; cls: string; bar: string }> = {
  'on-track':       { label: 'On track', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', bar: 'bg-emerald-400' },
  caution:          { label: 'Caution — reduce risk', cls: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10', bar: 'bg-yellow-400' },
  danger:           { label: 'Danger — one bad trade from violation', cls: 'text-orange-400 border-orange-500/30 bg-orange-500/10', bar: 'bg-orange-400' },
  passed:           { label: 'Profit target reached 🎉', cls: 'text-[#58a6ff] border-[#58a6ff]/30 bg-[#58a6ff]/10', bar: 'bg-[#58a6ff]' },
  'violated-daily': { label: 'Daily loss limit VIOLATED', cls: 'text-red-400 border-red-500/30 bg-red-500/10', bar: 'bg-red-400' },
  'violated-total': { label: 'Max drawdown VIOLATED', cls: 'text-red-400 border-red-500/30 bg-red-500/10', bar: 'bg-red-400' },
}

export default function ChallengePage() {
  const [config, setConfig] = useState<ChallengeConfig>(defaultConfig)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setConfig({ ...defaultConfig(), ...JSON.parse(raw) })
    } catch {
      // corrupt storage — fall back to defaults
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  }, [config, loaded])

  function update(patch: Partial<ChallengeConfig>) {
    setConfig(c => ({ ...c, ...patch }))
  }

  function updateRules(patch: Partial<ChallengeRules>) {
    setConfig(c => ({ ...c, rules: { ...c.rules, ...patch } }))
  }

  function applyPreset(presetId: string) {
    const preset = CHALLENGE_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    setConfig(c => ({
      ...c,
      presetId,
      rules: { accountSize: c.rules.accountSize, ...preset.rules },
    }))
  }

  function startNewDay() {
    update({ dayStartEquity: config.equity, dayStamp: new Date().toISOString().slice(0, 10) })
  }

  function resetChallenge() {
    const size = config.rules.accountSize
    update({ equity: size, dayStartEquity: size, dayStamp: new Date().toISOString().slice(0, 10) })
  }

  const ev = evaluateChallenge(config.rules, {
    equity: config.equity,
    dayStartEquity: config.dayStartEquity,
  })
  const status = STATUS_UI[ev.status]
  const today = new Date().toISOString().slice(0, 10)
  const staleDay = loaded && config.dayStamp !== today

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Challenge Tracker" subtitle="Stay inside your prop-firm rules — pass on your terms" />

      <main className="flex-1 p-6 space-y-6">
        {staleDay && (
          <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-sm text-yellow-400">
            <span>
              Your &quot;day start equity&quot; is from {config.dayStamp}. Daily limits reset each
              trading day — start a new day to re-anchor it.
            </span>
            <button
              onClick={startNewDay}
              className="ml-4 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
            >
              Start new day
            </button>
          </div>
        )}

        {/* Status banner */}
        <div className={`border rounded-xl px-5 py-4 ${status.cls}`}>
          <div className="text-lg font-semibold">{status.label}</div>
          {config.rules.profitTargetPct > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs opacity-80 mb-1">
                <span>Progress to ${fmt(ev.targetEquity)}</span>
                <span>{ev.progressPct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${status.bar}`} style={{ width: `${ev.progressPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Live limits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardBody>
              <div className="text-xs text-[#8b949e] mb-1">Room before daily violation</div>
              <div className="text-2xl font-bold text-[#e6edf3]">${fmt(ev.remainingDaily)}</div>
              <div className="text-xs text-[#484f58] mt-1">Violated at ${fmt(ev.dailyLossFloor)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-[#8b949e] mb-1">Room before max drawdown</div>
              <div className="text-2xl font-bold text-[#e6edf3]">${fmt(ev.remainingTotal)}</div>
              <div className="text-xs text-[#484f58] mt-1">Violated at ${fmt(ev.totalLossFloor)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-[#8b949e] mb-1">Suggested max risk on next trade</div>
              <div className="text-2xl font-bold text-[#3fb950]">${fmt(ev.suggestedRiskUsd)}</div>
              <div className="text-xs text-[#484f58] mt-1">
                Survives 3 straight losses ·{' '}
                <Link href="/tools/position-size-calculator" className="text-[#58a6ff] hover:underline">
                  convert to lots →
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equity input */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-[#e6edf3]">Today</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className={labelCls}>Current equity (USD)</label>
                <input
                  type="number"
                  min={0}
                  value={config.equity}
                  onChange={e => update({ equity: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Equity at start of today (USD)</label>
                <input
                  type="number"
                  min={0}
                  value={config.dayStartEquity}
                  onChange={e => update({ dayStartEquity: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={startNewDay}
                  className="px-4 py-2 bg-[#58a6ff] hover:bg-[#4393e6] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Start new trading day
                </button>
                <button
                  onClick={resetChallenge}
                  className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] text-sm font-medium rounded-lg transition-colors"
                >
                  Reset challenge
                </button>
              </div>
            </CardBody>
          </Card>

          {/* Rules */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-[#e6edf3]">Challenge rules</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className={labelCls}>Preset</label>
                <select value={config.presetId} onChange={e => applyPreset(e.target.value)} className={inputCls}>
                  {CHALLENGE_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Account size (USD)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {ACCOUNT_SIZES.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updateRules({ accountSize: size })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        config.rules.accountSize === size
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
                  value={config.rules.accountSize}
                  onChange={e => updateRules({ accountSize: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Target %</label>
                  <input
                    type="number" min={0} step={0.5}
                    value={config.rules.profitTargetPct}
                    onChange={e => updateRules({ profitTargetPct: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Daily loss %</label>
                  <input
                    type="number" min={0} step={0.5}
                    value={config.rules.maxDailyLossPct}
                    onChange={e => updateRules({ maxDailyLossPct: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Max loss %</label>
                  <input
                    type="number" min={0} step={0.5}
                    value={config.rules.maxTotalLossPct}
                    onChange={e => updateRules({ maxTotalLossPct: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
              </div>
              <p className="text-xs text-[#484f58]">
                Presets reflect typical industry rule structures. Firms differ on balance-vs-equity
                measurement and trailing drawdown — always verify against your firm&apos;s dashboard.
              </p>
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  )
}
