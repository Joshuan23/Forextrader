'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SMCAnalysis, SMCSignal } from '@/types/smc'
import { SignalCard } from '@/components/smc/SignalCard'
import { StructurePanel } from '@/components/smc/StructurePanel'
import { RefreshCw, Zap, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CURRENCY_PAIRS, getPairsByClass } from '@/lib/forex/pairs'

const FOREX_PAIRS   = getPairsByClass('forex').map((p) => p.symbol)
const METAL_PAIRS   = getPairsByClass('metal').map((p) => p.symbol)
const INDEX_PAIRS   = getPairsByClass('index').map((p) => p.symbol)
const TIMEFRAMES = ['15m', '1h', '4h', '1d'] as const

type TF = (typeof TIMEFRAMES)[number]

// API response type (candles stripped)
type SMCApiResponse = Omit<SMCAnalysis, 'candles'> & {
  dataSource: 'live' | 'simulated'
  candleCount: number
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function SignalsPage() {
  const [pair, setPair] = useState('EUR/USD')
  const [timeframe, setTimeframe] = useState<TF>('1h')
  const [analysis, setAnalysis] = useState<SMCApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)

  const fetchAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/smc?pair=${encodeURIComponent(pair)}&timeframe=${timeframe}&count=200`
      )
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as SMCApiResponse
      setAnalysis(data)
      setLastRefresh(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [pair, timeframe])

  // Fetch on mount and when pair/timeframe changes
  useEffect(() => {
    fetchAnalysis()
  }, [fetchAnalysis])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAnalysis()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchAnalysis])

  const highSignals = analysis?.signals.filter((s) => s.confidence === 'high') ?? []
  const mediumSignals = analysis?.signals.filter((s) => s.confidence === 'medium') ?? []
  const lowSignals = analysis?.signals.filter((s) => s.confidence === 'low') ?? []

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3] flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-400" />
            Smart Money Signals
          </h1>
          <p className="text-sm text-[#8b949e] mt-1">
            Institutional order flow analysis powered by SMC concepts
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Data source badge */}
          {analysis && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
                analysis.dataSource === 'live'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full animate-pulse',
                  analysis.dataSource === 'live' ? 'bg-emerald-400' : 'bg-amber-400'
                )}
              />
              {analysis.dataSource === 'live' ? 'LIVE DATA' : 'SIMULATED'}
            </span>
          )}

          {/* Refresh button */}
          <button
            onClick={fetchAnalysis}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] text-sm rounded border border-[#30363d] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last refresh info */}
      {lastRefresh && !loading && (
        <p className="text-xs text-[#8b949e]">
          Last updated: {timeAgo(lastRefresh)} • Auto-refreshes every 5 minutes
        </p>
      )}

      {/* Simulated data warning */}
      {analysis?.dataSource === 'simulated' && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">Using Simulated Data</p>
            <p className="text-xs text-amber-400/80 mt-1">
              Add <code className="bg-amber-500/20 px-1 rounded font-mono">ALPHA_VANTAGE_API_KEY</code> to{' '}
              <code className="bg-amber-500/20 px-1 rounded font-mono">.env.local</code> for live
              forex &amp; metals data (free key at{' '}
              <a
                href="https://www.alphavantage.co/support/#api-key"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-300"
              >
                alphavantage.co
              </a>
              ). Indices (NAS100, US500) always use high-fidelity GBM simulation.
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Error loading analysis</p>
            <p className="text-xs text-red-400/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-3">
        <p className="text-xs text-[#8b949e] font-medium">INSTRUMENT</p>
        {/* Instrument selector — grouped by asset class */}
        <div className="space-y-2">
          {[
            { label: 'FOREX',   pairs: FOREX_PAIRS,  accent: '#58a6ff' },
            { label: 'METALS',  pairs: METAL_PAIRS,  accent: '#d29922' },
            { label: 'INDICES', pairs: INDEX_PAIRS,  accent: '#a371f7' },
          ].map(({ label, pairs, accent }) => (
            <div key={label} className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold w-14 shrink-0" style={{ color: accent }}>
                {label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {pairs.map((sym) => {
                  const cfg = CURRENCY_PAIRS.find((p) => p.symbol === sym)
                  const isActive = pair === sym
                  return (
                    <button
                      key={sym}
                      onClick={() => setPair(sym)}
                      title={cfg?.name}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded border transition-colors font-mono',
                        isActive
                          ? 'text-white border-transparent'
                          : 'bg-[#21262d] text-[#8b949e] border-[#30363d] hover:text-[#e6edf3]'
                      )}
                      style={isActive ? { background: accent, borderColor: accent } : undefined}
                    >
                      {sym}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Timeframe selector */}
        <div>
          <p className="text-xs text-[#8b949e] mb-2 font-medium">TIMEFRAME</p>
          <div className="flex gap-2">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  'px-4 py-1.5 text-sm rounded border transition-colors',
                  tf === timeframe
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                    : 'bg-[#21262d] text-[#8b949e] border-[#30363d] hover:text-[#e6edf3]'
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-sm text-[#8b949e]">
              Analyzing {pair} on {timeframe}...
            </p>
          </div>
        </div>
      )}

      {/* Analysis content */}
      {!loading && analysis && (
        <div className="space-y-6">
          {/* Structure Panel */}
          <StructurePanel analysis={analysis} />

          {/* Signal summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-[#e6edf3]">{analysis.signals.length}</div>
              <div className="text-xs text-[#8b949e] mt-1">Total Signals</div>
            </div>
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{highSignals.length}</div>
              <div className="text-xs text-[#8b949e] mt-1">High Confidence</div>
            </div>
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{mediumSignals.length}</div>
              <div className="text-xs text-[#8b949e] mt-1">Medium Confidence</div>
            </div>
            <div className="bg-[#161b22] border border-emerald-500/20 rounded-lg p-3 text-center">
              <div className="text-sm font-medium text-[#e6edf3]">{pair}</div>
              <div className="text-xs text-[#8b949e]">{timeframe}</div>
              <div className="text-xs text-[#8b949e] mt-1">{analysis.candleCount} candles</div>
            </div>
          </div>

          {/* Signal sections */}
          {analysis.signals.length === 0 ? (
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-8 text-center space-y-4">
              <div className="text-4xl">🔍</div>
              <div>
                <p className="text-[#e6edf3] font-medium">No signals found</p>
                <p className="text-sm text-[#8b949e] mt-1">
                  The analysis scanned but found no high-quality setups currently
                </p>
              </div>
              <div className="text-left inline-block">
                <p className="text-xs text-[#8b949e] font-medium mb-2">What was scanned:</p>
                <ul className="space-y-1 text-xs text-[#8b949e]">
                  <li>• {analysis.swingPoints.length} swing points detected</li>
                  <li>• {analysis.structureBreaks.length} structure breaks identified</li>
                  <li>• {analysis.orderBlocks.length} order blocks mapped</li>
                  <li>• {analysis.fairValueGaps.length} fair value gaps found</li>
                  <li>• {analysis.liquidityLevels.length} liquidity levels tracked</li>
                  <li>• {analysis.sweeps.length} liquidity sweeps recorded</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* High Confidence */}
              {highSignals.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    High Confidence Setups ({highSignals.length})
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {highSignals.map((signal) => (
                      <SignalCard key={signal.id} signal={signal} />
                    ))}
                  </div>
                </div>
              )}

              {/* Medium Confidence */}
              {mediumSignals.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Medium Confidence ({mediumSignals.length})
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {mediumSignals.map((signal) => (
                      <SignalCard key={signal.id} signal={signal} />
                    ))}
                  </div>
                </div>
              )}

              {/* Low Confidence */}
              {lowSignals.length > 0 && (
                <div className="opacity-70">
                  <h2 className="text-sm font-semibold text-[#8b949e] mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#8b949e]" />
                    Low Confidence — Monitor Only ({lowSignals.length})
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {lowSignals.map((signal) => (
                      <SignalCard key={signal.id} signal={signal} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SMC Education footer */}
          <div className="border-t border-[#21262d] pt-6">
            <h3 className="text-sm font-semibold text-[#8b949e] mb-4 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Smart Money Concepts — Reference Guide
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4">
                <h4 className="text-xs font-semibold text-blue-400 mb-2">ORDER BLOCKS (OB)</h4>
                <p className="text-xs text-[#8b949e]">
                  The last bearish candle before a bullish impulse (bullish OB), or last bullish candle
                  before a bearish impulse (bearish OB). These zones represent institutional order
                  placement areas where price tends to react.
                </p>
              </div>
              <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4">
                <h4 className="text-xs font-semibold text-amber-400 mb-2">FAIR VALUE GAPS (FVG)</h4>
                <p className="text-xs text-[#8b949e]">
                  An imbalance between 3 consecutive candles where the 1st and 3rd candle do not
                  overlap. Price tends to return to fill these gaps before continuing the trend.
                  Also called an imbalance or IFVG.
                </p>
              </div>
              <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4">
                <h4 className="text-xs font-semibold text-purple-400 mb-2">LIQUIDITY SWEEPS</h4>
                <p className="text-xs text-[#8b949e]">
                  When price briefly exceeds a swing high/low to grab stop losses before reversing.
                  Sweeps with reversal confirmation are strong signals that smart money has absorbed
                  retail orders and is ready to move in the opposite direction.
                </p>
              </div>
              <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4">
                <h4 className="text-xs font-semibold text-emerald-400 mb-2">BOS / CHoCH</h4>
                <p className="text-xs text-[#8b949e]">
                  <strong className="text-[#e6edf3]">Break of Structure (BOS)</strong>: Continuation
                  signal — price breaks a swing in the direction of the trend.{' '}
                  <strong className="text-[#e6edf3]">Change of Character (CHoCH)</strong>: Reversal
                  signal — price breaks structure against the prevailing trend, suggesting a potential
                  shift.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
