'use client'

import { useMemo } from 'react'
import type { Candle } from '@/types/forex'
import type { OrderBlock, FairValueGap, LiquidityLevel, SMCSignal } from '@/types/smc'
import type { COTReport } from '@/types/cot'
import { CURRENCY_PAIRS } from '@/lib/forex/pairs'

// ── Chart constants ──────────────────────────────────────────────────────────

const SVG_W = 1100
const SVG_H = 440
const PAD   = { top: 22, right: 118, bottom: 38, left: 72 }
const CW    = SVG_W - PAD.left - PAD.right  // 910
const CH    = SVG_H - PAD.top  - PAD.bottom // 380
const N_HIST = 55
const N_PROJ = 20
const TOTAL  = N_HIST + N_PROJ
const SLOT   = CW / TOTAL          // px per bar slot
const BODY_W = Math.max(2, SLOT * 0.6)

// ── Types ────────────────────────────────────────────────────────────────────

interface KingNode {
  price:     number
  label:     string
  color:     string
  lineStyle: 'solid' | 'dashed' | 'dotted'
  weight:    number
  type:      'ob' | 'fvg' | 'liquidity' | 'entry' | 'sl' | 'tp'
  zoneTop?:  number
  zoneBot?:  number
}

interface ProjBar {
  i:      number   // 1-based
  center: number
  u1:     number
  l1:     number
  u2:     number
  l2:     number
}

// ── Data helpers ─────────────────────────────────────────────────────────────

function atr14(candles: Candle[]): number {
  const slice = candles.slice(-14)
  return slice.reduce((s, c) => s + (c.high - c.low), 0) / Math.max(slice.length, 1)
}

function computeProjection(
  candles: Candle[],
  direction: 'bullish' | 'bearish' | 'neutral',
  cotScore: number,
  nearestTarget: number | null,
): ProjBar[] {
  if (candles.length < 3) return []
  const price = candles[candles.length - 1].close
  const atr   = atr14(candles)
  const sign  = direction === 'bullish' ? 1 : direction === 'bearish' ? -1 : 0
  const mag   = (Math.abs(cotScore) / 100) * 0.18 + 0.04
  const drift = sign * mag * atr

  // Gentle quadratic pull toward nearest target (if within reach)
  const targetPull = nearestTarget !== null
    ? Math.max(-atr * 0.4, Math.min(atr * 0.4,
        (nearestTarget - (price + drift * N_PROJ)) / (N_PROJ * N_PROJ) * 0.5
      ))
    : 0

  return Array.from({ length: N_PROJ }, (_, idx) => {
    const i  = idx + 1
    const c  = price + drift * i + targetPull * i * i
    const u  = atr * Math.sqrt(i * 0.65)
    return { i, center: c, u1: c + u, l1: c - u, u2: c + u * 1.85, l2: c - u * 1.85 }
  })
}

function extractNodes(
  obs:      OrderBlock[],
  fvgs:     FairValueGap[],
  liqs:     LiquidityLevel[],
  signals:  SMCSignal[],
  price:    number,
  atr:      number,
): KingNode[] {
  const reach  = atr * 12   // show levels within 12 ATRs
  const nodes: KingNode[] = []

  // Order blocks
  obs.filter(ob => !ob.mitigated).forEach(ob => {
    const ref = ob.type === 'bullish' ? ob.high : ob.low
    if (Math.abs(ref - price) > reach) return
    nodes.push({
      price:     ref,
      label:     ob.type === 'bullish' ? '▲ Bull OB' : '▼ Bear OB',
      color:     ob.type === 'bullish' ? '#58a6ff' : '#f85149',
      lineStyle: 'solid',
      weight:    ob.strength === 'strong' ? 2.5 : ob.strength === 'medium' ? 1.8 : 1.2,
      type:      'ob',
      zoneTop:   ob.high,
      zoneBot:   ob.low,
    })
  })

  // FVGs
  fvgs.filter(f => !f.filled && f.fillPercent < 70).forEach(fvg => {
    if (Math.abs(fvg.mid - price) > reach) return
    nodes.push({
      price:     fvg.mid,
      label:     fvg.type === 'bullish' ? '↑ FVG' : '↓ FVG',
      color:     '#d29922',
      lineStyle: 'dashed',
      weight:    1.4,
      type:      'fvg',
      zoneTop:   fvg.top,
      zoneBot:   fvg.bottom,
    })
  })

  // Liquidity levels
  liqs
    .filter(l => !l.swept && Math.abs(l.price - price) <= reach)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 4)
    .forEach(liq => {
      nodes.push({
        price:     liq.price,
        label:     liq.type.includes('high') ? '⚡ Liq High' : '⚡ Liq Low',
        color:     '#a371f7',
        lineStyle: 'dotted',
        weight:    1.2,
        type:      'liquidity',
      })
    })

  // Deduplicate (merge nodes within 0.03% of each other)
  const deduped: KingNode[] = []
  nodes
    .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))
    .forEach(n => {
      const tooClose = deduped.some(d => Math.abs(d.price - n.price) / price < 0.0003)
      if (!tooClose) deduped.push(n)
    })

  return deduped.slice(0, 9)
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  candles:    Candle[]
  orderBlocks: OrderBlock[]
  fairValueGaps: FairValueGap[]
  liquidityLevels: LiquidityLevel[]
  signals:    SMCSignal[]
  cotReport?: COTReport
  pair:       string
  timeframe:  string
  bias:       'bullish' | 'bearish' | 'ranging'
}

// ── Main component ───────────────────────────────────────────────────────────

export function ProjectionChart({
  candles, orderBlocks, fairValueGaps, liquidityLevels, signals, cotReport, pair, timeframe, bias,
}: Props) {
  const pairConf = useMemo(() => CURRENCY_PAIRS.find(p => p.symbol === pair), [pair])
  const digits   = pairConf?.digits ?? 5

  const fmt = (p: number) =>
    p >= 1000
      ? p.toLocaleString('en-US', { maximumFractionDigits: digits })
      : p.toFixed(digits)

  const hist = useMemo(() => candles.slice(-N_HIST), [candles])

  const { nodes, proj, priceMin, priceMax, currentPrice, direction, cotScore, nearestTarget, bestSignal } =
    useMemo(() => {
      if (hist.length === 0) return { nodes: [], proj: [], priceMin: 0, priceMax: 0, currentPrice: 0, direction: 'neutral' as const, cotScore: 0, nearestTarget: null, bestSignal: null }

      const cp    = hist[hist.length - 1].close
      const atr   = atr14(hist)
      const score = cotReport?.institutionalScore ?? 0

      const dir: 'bullish' | 'bearish' | 'neutral' =
        (cotReport && cotReport.source !== 'unavailable')
          ? (score >= 15 ? 'bullish' : score <= -15 ? 'bearish' : bias === 'ranging' ? 'neutral' : bias)
          : (bias === 'ranging' ? 'neutral' : bias)

      const kNodes = extractNodes(orderBlocks, fairValueGaps, liquidityLevels, signals, cp, atr)
      const bestSignal = signals.find(s => s.confidence === 'high') ?? signals.find(s => s.confidence === 'medium') ?? null

      // Find nearest target in the direction of trade
      const targetNodes = kNodes.filter(n =>
        dir === 'bullish' ? n.price > cp : dir === 'bearish' ? n.price < cp : false
      )
      const nearest = targetNodes.length > 0
        ? targetNodes.reduce((a, b) => Math.abs(a.price - cp) < Math.abs(b.price - cp) ? a : b).price
        : null

      const p = computeProjection(hist, dir, score, nearest)

      // Price range: candles + nodes + projection
      const allPrices = [
        ...hist.flatMap(c => [c.high, c.low]),
        ...kNodes.flatMap(n => [n.price, n.zoneTop ?? n.price, n.zoneBot ?? n.price]),
        ...p.flatMap(b => [b.u2, b.l2]),
        ...(bestSignal ? [bestSignal.entry, bestSignal.stopLoss, ...bestSignal.takeProfits.slice(0, 2).map(t => t.price)] : []),
      ].filter(v => v > 0)

      const pMin = Math.min(...allPrices)
      const pMax = Math.max(...allPrices)
      const pad  = (pMax - pMin) * 0.06

      return {
        nodes:         kNodes,
        proj:          p,
        priceMin:      pMin - pad,
        priceMax:      pMax + pad,
        currentPrice:  cp,
        direction:     dir,
        cotScore:      score,
        nearestTarget: nearest,
        bestSignal,
      }
    }, [hist, orderBlocks, fairValueGaps, liquidityLevels, signals, cotReport, bias])

  if (hist.length < 5) {
    return (
      <div className="rounded-lg border border-[#21262d] bg-[#0d1117] p-6 flex items-center justify-center text-[#8b949e] text-sm" style={{ height: 260 }}>
        Loading chart data…
      </div>
    )
  }

  // ── Coordinate helpers ────────────────────────────────────────────────────

  const priceRange = priceMax - priceMin
  const yOf = (p: number) => PAD.top + CH * (1 - (p - priceMin) / priceRange)
  const xOf = (barIdx: number) => PAD.left + (barIdx + 0.5) * SLOT  // center of bar slot

  // Historical bar slots 0..N_HIST-1; projected slots N_HIST..N_HIST+N_PROJ-1
  const sepX = PAD.left + N_HIST * SLOT

  // ── Projection SVG paths ─────────────────────────────────────────────────

  const projPts = proj.map((b, i) => ({ x: xOf(N_HIST + i), ...b }))

  const pathCenter = projPts.length > 0
    ? `M ${xOf(N_HIST - 1)} ${yOf(currentPrice)} ` +
      projPts.map(p => `L ${p.x} ${yOf(p.center)}`).join(' ')
    : ''

  const pathBand = (top: (p: typeof projPts[0]) => number, bot: (p: typeof projPts[0]) => number) => {
    if (projPts.length === 0) return ''
    const startX = xOf(N_HIST - 1)
    const startY = yOf(currentPrice)
    const upper = projPts.map(p => `L ${p.x} ${yOf(top(p))}`).join(' ')
    const lower = [...projPts].reverse().map(p => `L ${p.x} ${yOf(bot(p))}`).join(' ')
    return `M ${startX} ${startY} ${upper} ${lower} Z`
  }

  const band1 = pathBand(p => p.u1, p => p.l1)
  const band2 = pathBand(p => p.u2, p => p.l2)

  const projColor = direction === 'bullish' ? '#3fb950' : direction === 'bearish' ? '#f85149' : '#8b949e'

  // ── Y-axis ticks ─────────────────────────────────────────────────────────

  const yTickCount = 7
  const yTicks = Array.from({ length: yTickCount }, (_, i) => {
    const price = priceMin + priceRange * (i / (yTickCount - 1))
    return { price, y: yOf(price) }
  })

  // ── X-axis ticks (every 10 bars) ─────────────────────────────────────────

  const xTicks: { label: string; x: number }[] = []
  if (hist.length > 0) {
    for (let i = 0; i < N_HIST; i += 10) {
      const candle = hist[i]
      if (!candle) continue
      const d = new Date(candle.time)
      const label = timeframe === '1d'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`
      xTicks.push({ label, x: xOf(i) })
    }
  }

  // ── Bias badge text ───────────────────────────────────────────────────────

  const biasText = direction === 'bullish'
    ? cotReport?.source !== 'unavailable' ? `COT +${cotScore} · Bullish` : 'Bullish'
    : direction === 'bearish'
    ? cotReport?.source !== 'unavailable' ? `COT ${cotScore} · Bearish` : 'Bearish'
    : 'Neutral'

  return (
    <div className="rounded-lg border border-[#21262d] bg-[#0d1117] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#21262d]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#e6edf3]">
            Institutional Projection
          </span>
          <span className="text-xs text-[#8b949e] font-mono">{pair} · {timeframe}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* King nodes legend */}
          <span className="text-xs text-[#484f58]">King Nodes:</span>
          {[
            { color: '#58a6ff', label: 'OB' },
            { color: '#d29922', label: 'FVG' },
            { color: '#a371f7', label: 'Liq' },
            { color: '#3fb950', label: 'TP' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1 text-xs text-[#8b949e]">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
          {/* Bias badge */}
          <span
            className="ml-2 text-xs px-2 py-0.5 rounded font-semibold"
            style={{
              color: projColor,
              backgroundColor: `${projColor}18`,
              border: `1px solid ${projColor}40`,
            }}
          >
            {biasText}
          </span>
        </div>
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Glow filter for king nodes */}
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Projection gradient */}
          <linearGradient id="projFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={projColor} stopOpacity="0.0" />
            <stop offset="100%" stopColor={projColor} stopOpacity="0.5" />
          </linearGradient>
          <clipPath id="chartClip">
            <rect x={PAD.left} y={PAD.top} width={CW} height={CH} />
          </clipPath>
        </defs>

        {/* Background */}
        <rect width={SVG_W} height={SVG_H} fill="#0d1117" />
        <rect x={PAD.left} y={PAD.top} width={CW} height={CH} fill="#0d1117" />

        {/* Projected area tint */}
        <rect
          x={sepX} y={PAD.top}
          width={PAD.left + CW - sepX} height={CH}
          fill={`${projColor}06`}
        />

        {/* Grid lines */}
        {yTicks.map(({ y }, i) => (
          <line
            key={i}
            x1={PAD.left} y1={y} x2={PAD.left + CW} y2={y}
            stroke="#21262d" strokeWidth="1"
          />
        ))}

        {/* King node heat zones (background rectangles) */}
        <g clipPath="url(#chartClip)">
          {nodes.map((n, i) => {
            if (!n.zoneTop || !n.zoneBot) return null
            const y1 = yOf(n.zoneTop)
            const y2 = yOf(n.zoneBot)
            const h  = Math.abs(y2 - y1)
            return (
              <rect
                key={`zone-${i}`}
                x={PAD.left} y={Math.min(y1, y2)}
                width={CW} height={Math.max(h, 1)}
                fill={n.color}
                opacity={0.07 * n.weight}
              />
            )
          })}

          {/* 2σ outer confidence band */}
          {band2 && (
            <path d={band2} fill={projColor} opacity="0.05" />
          )}
          {/* 1σ inner confidence band */}
          {band1 && (
            <path d={band1} fill={projColor} opacity="0.11" />
          )}

          {/* Trade setup zone fills (risk / reward regions) */}
          {bestSignal && (() => {
            const ey = yOf(bestSignal.entry)
            const sy = yOf(bestSignal.stopLoss)
            const tp1 = bestSignal.takeProfits[0]
            const tp2 = bestSignal.takeProfits[1]
            const t1y = tp1 ? yOf(tp1.price) : null
            const t2y = tp2 ? yOf(tp2.price) : null
            const a = bestSignal.confidence === 'high' ? 1 : 0.6
            return (
              <>
                {/* Risk zone: SL → Entry */}
                <rect x={PAD.left} y={Math.min(ey, sy)} width={CW} height={Math.max(1, Math.abs(ey - sy))} fill="#f85149" opacity={0.11 * a} />
                {/* Reward zone 1: Entry → TP1 */}
                {t1y !== null && <rect x={PAD.left} y={Math.min(ey, t1y)} width={CW} height={Math.max(1, Math.abs(ey - t1y))} fill="#3fb950" opacity={0.09 * a} />}
                {/* Reward zone 2: TP1 → TP2 */}
                {t1y !== null && t2y !== null && <rect x={PAD.left} y={Math.min(t1y, t2y)} width={CW} height={Math.max(1, Math.abs(t1y - t2y))} fill="#3fb950" opacity={0.05 * a} />}
              </>
            )
          })()}

          {/* Projection upper/lower boundary lines */}
          {projPts.length > 1 && (
            <>
              <polyline
                points={[
                  `${xOf(N_HIST - 1)},${yOf(currentPrice)}`,
                  ...projPts.map(p => `${p.x},${yOf(p.u1)}`),
                ].join(' ')}
                fill="none" stroke={projColor} strokeWidth="0.8" strokeOpacity="0.4"
                strokeDasharray="3 3"
              />
              <polyline
                points={[
                  `${xOf(N_HIST - 1)},${yOf(currentPrice)}`,
                  ...projPts.map(p => `${p.x},${yOf(p.l1)}`),
                ].join(' ')}
                fill="none" stroke={projColor} strokeWidth="0.8" strokeOpacity="0.4"
                strokeDasharray="3 3"
              />
            </>
          )}

          {/* Historical candlesticks */}
          {hist.map((c, i) => {
            const isUp  = c.close >= c.open
            const color = isUp ? '#3fb950' : '#f85149'
            const bodyY = yOf(Math.max(c.open, c.close))
            const bodyH = Math.max(1, Math.abs(yOf(c.open) - yOf(c.close)))
            const cx    = xOf(i)
            return (
              <g key={i}>
                {/* Wick */}
                <line
                  x1={cx} y1={yOf(c.high)}
                  x2={cx} y2={yOf(c.low)}
                  stroke={color} strokeWidth="1" opacity="0.8"
                />
                {/* Body */}
                <rect
                  x={cx - BODY_W / 2} y={bodyY}
                  width={BODY_W} height={bodyH}
                  fill={isUp ? color : 'none'}
                  stroke={color}
                  strokeWidth={isUp ? 0 : 1}
                  opacity="0.9"
                />
              </g>
            )
          })}

          {/* Projection center line */}
          {pathCenter && (
            <path
              d={pathCenter}
              fill="none"
              stroke={projColor}
              strokeWidth="2"
              strokeDasharray="5 3"
              opacity="0.85"
            />
          )}

          {/* Direction arrow at end of projection */}
          {projPts.length > 0 && (() => {
            const last = projPts[projPts.length - 1]
            const prev = projPts[projPts.length - 2] ?? { x: xOf(N_HIST - 1), center: currentPrice }
            const dx = last.x - prev.x
            const dy = yOf(last.center) - yOf(prev.center)
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            const nx = dx / len, ny = dy / len
            const tip = { x: last.x, y: yOf(last.center) }
            const b1  = { x: tip.x - nx * 10 + ny * 5,  y: tip.y - ny * 10 - nx * 5  }
            const b2  = { x: tip.x - nx * 10 - ny * 5,  y: tip.y - ny * 10 + nx * 5  }
            return (
              <polygon
                points={`${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`}
                fill={projColor} opacity="0.9"
              />
            )
          })()}

          {/* King node horizontal lines */}
          {nodes.map((n, i) => {
            const y = yOf(n.price)
            const dash = n.lineStyle === 'dashed' ? '5 3' : n.lineStyle === 'dotted' ? '2 3' : 'none'
            return (
              <line
                key={`nodeline-${i}`}
                x1={PAD.left} y1={y} x2={PAD.left + CW} y2={y}
                stroke={n.color}
                strokeWidth={n.weight * 0.7}
                strokeDasharray={dash === 'none' ? undefined : dash}
                opacity={0.55}
              />
            )
          })}

          {/* Trade setup level lines (SL / Entry / TP1 / TP2) */}
          {bestSignal && (() => {
            const isBuy = bestSignal.direction === 'buy'
            const ec = isBuy ? '#3fb950' : '#f85149'
            const ey = yOf(bestSignal.entry)
            const sy = yOf(bestSignal.stopLoss)
            const tp1 = bestSignal.takeProfits[0]
            const tp2 = bestSignal.takeProfits[1]
            const t1y = tp1 ? yOf(tp1.price) : null
            const t2y = tp2 ? yOf(tp2.price) : null
            const a = bestSignal.confidence === 'high' ? 1 : 0.65
            return (
              <>
                <line x1={PAD.left} y1={sy} x2={PAD.left + CW} y2={sy} stroke="#f85149" strokeWidth="1.5" strokeDasharray="6 3" opacity={0.80 * a} />
                <line x1={PAD.left} y1={ey} x2={PAD.left + CW} y2={ey} stroke={ec} strokeWidth="2.5" opacity={0.90 * a} />
                {t1y !== null && <line x1={PAD.left} y1={t1y} x2={PAD.left + CW} y2={t1y} stroke="#3fb950" strokeWidth="1.5" strokeDasharray="6 3" opacity={0.80 * a} />}
                {t2y !== null && <line x1={PAD.left} y1={t2y} x2={PAD.left + CW} y2={t2y} stroke="#56d364" strokeWidth="1.2" strokeDasharray="2 4" opacity={0.60 * a} />}
              </>
            )
          })()}

          {/* Current price line */}
          <line
            x1={PAD.left} y1={yOf(currentPrice)}
            x2={PAD.left + CW} y2={yOf(currentPrice)}
            stroke="#e6edf3" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.5"
          />
        </g>

        {/* Separator between historical and projected */}
        <line
          x1={sepX} y1={PAD.top}
          x2={sepX} y2={PAD.top + CH}
          stroke="#30363d" strokeWidth="1" strokeDasharray="4 4"
        />
        <text x={sepX + 4} y={PAD.top + 12} fill="#484f58" fontSize="9" fontFamily="monospace">
          PROJECTED →
        </text>

        {/* Trade setup level labels (right margin pills) */}
        {bestSignal && (() => {
          const isBuy = bestSignal.direction === 'buy'
          const ec = isBuy ? '#3fb950' : '#f85149'
          const ey = yOf(bestSignal.entry)
          const sy = yOf(bestSignal.stopLoss)
          const tp1 = bestSignal.takeProfits[0]
          const tp2 = bestSignal.takeProfits[1]
          const t1y = tp1 ? yOf(tp1.price) : null
          const t2y = tp2 ? yOf(tp2.price) : null
          const a  = bestSignal.confidence === 'high' ? 1 : 0.75
          const lx = PAD.left + CW + 3
          const pw = 112
          const isHigh = bestSignal.confidence === 'high'

          const pill = (y: number, top: string, bot: string, color: string, key: string) => {
            if (y < PAD.top - 10 || y > PAD.top + CH + 10) return null
            return (
              <g key={key}>
                <line x1={PAD.left + CW} y1={y} x2={lx} y2={y} stroke={color} strokeWidth="0.8" opacity="0.6" />
                <rect x={lx} y={y - 12} width={pw} height={22} fill={`${color}20`} rx="2" stroke={color} strokeWidth="0.7" />
                <text x={lx + 4} y={y - 3} fill={color} fontSize="8.5" fontFamily="'SF Mono', monospace" fontWeight="700">{top}</text>
                <text x={lx + 4} y={y + 8} fill="#8b949e" fontSize="7.5" fontFamily="'SF Mono', monospace">{bot}</text>
              </g>
            )
          }

          return (
            <g opacity={a}>
              {pill(sy, '✕ SL', fmt(bestSignal.stopLoss), '#f85149', 'tsl')}
              {pill(ey,
                isBuy ? '▲ BUY ENTRY' : '▼ SELL ENTRY',
                `${fmt(bestSignal.entry)}  ${isHigh ? 'HIGH' : 'MED'}`,
                ec, 'tent'
              )}
              {tp1 && t1y !== null && pill(t1y, '◎ TP1', `${fmt(tp1.price)}  ${tp1.rr.toFixed(1)}R`, '#3fb950', 'ttp1')}
              {tp2 && t2y !== null && pill(t2y, '◎ TP2', `${fmt(tp2.price)}  ${tp2.rr.toFixed(1)}R`, '#56d364', 'ttp2')}
            </g>
          )
        })()}

        {/* King node labels & circles (right of chart) */}
        {nodes.map((n, i) => {
          const y       = yOf(n.price)
          const cx      = PAD.left + CW + 8
          const r       = 5 + n.weight * 1.2
          if (y < PAD.top - 5 || y > PAD.top + CH + 5) return null
          return (
            <g key={`nodelabel-${i}`} filter="url(#glow)">
              {/* Price tag line */}
              <line
                x1={PAD.left + CW} y1={y}
                x2={cx} y2={y}
                stroke={n.color} strokeWidth="0.8" opacity="0.6"
              />
              {/* Circle */}
              <circle cx={cx + r} cy={y} r={r} fill={`${n.color}22`} stroke={n.color} strokeWidth="1.2" />
              <circle cx={cx + r} cy={y} r={r * 0.4} fill={n.color} />
              {/* Label */}
              <text
                x={cx + r * 2 + 4} y={y + 4}
                fill={n.color}
                fontSize="9.5"
                fontFamily="'SF Mono', monospace"
                fontWeight="600"
              >
                {n.label}
              </text>
              {/* Price */}
              <text
                x={cx + r * 2 + 4} y={y + 15}
                fill="#8b949e"
                fontSize="8.5"
                fontFamily="'SF Mono', monospace"
              >
                {fmt(n.price)}
              </text>
            </g>
          )
        })}

        {/* Current price label */}
        <rect
          x={PAD.left + CW - 1} y={yOf(currentPrice) - 8}
          width={68} height={15}
          fill="#e6edf322" rx="2"
        />
        <text
          x={PAD.left + CW + 3} y={yOf(currentPrice) + 4}
          fill="#e6edf3" fontSize="9.5" fontFamily="monospace" fontWeight="600"
        >
          {fmt(currentPrice)}
        </text>

        {/* Y-axis labels */}
        {yTicks.map(({ price, y }, i) => (
          <text
            key={i}
            x={PAD.left - 5} y={y + 4}
            fill="#8b949e" fontSize="9.5" fontFamily="monospace"
            textAnchor="end"
          >
            {fmt(price)}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map(({ label, x }, i) => (
          <text
            key={i}
            x={x} y={PAD.top + CH + 16}
            fill="#484f58" fontSize="9" fontFamily="monospace"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}

        {/* Projection target dotted line (nearest target) */}
        {nearestTarget !== null && (
          <>
            <line
              x1={xOf(N_HIST - 1)} y1={yOf(nearestTarget)}
              x2={PAD.left + CW}   y2={yOf(nearestTarget)}
              stroke={projColor} strokeWidth="1" strokeDasharray="2 4" opacity="0.3"
            />
          </>
        )}

        {/* "PROJECTION" watermark zone */}
        <text
          x={(sepX + PAD.left + CW) / 2} y={PAD.top + CH - 10}
          fill="#21262d" fontSize="11" fontFamily="monospace" fontWeight="700"
          textAnchor="middle"
        >
          {direction.toUpperCase()} PROJECTION
        </text>
      </svg>
    </div>
  )
}
