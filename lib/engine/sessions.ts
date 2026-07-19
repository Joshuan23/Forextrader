import type { SessionInfo, SessionTag } from './types'
import { SESSION_LABELS } from './types'

// FX session windows in UTC. Approximate institutional convention:
//   Asia (Tokyo/Sydney):  23:00 – 08:00
//   London:               07:00 – 16:00
//   New York:             12:00 – 21:00
// Overlaps: Asia/London 07:00–08:00, London/NY 12:00–16:00.
// 21:00–23:00 is the post-NY dead zone (worst liquidity of the day).
// Market closed: Friday 21:00 → Sunday 21:00 UTC.

interface Window {
  name: string
  startH: number
  endH: number // exclusive; may wrap midnight
}

const SESSIONS: Window[] = [
  { name: 'Asia', startH: 23, endH: 8 },
  { name: 'London', startH: 7, endH: 16 },
  { name: 'New York', startH: 12, endH: 21 },
]

function inWindow(hour: number, w: Window): boolean {
  return w.startH < w.endH
    ? hour >= w.startH && hour < w.endH
    : hour >= w.startH || hour < w.endH
}

export function isMarketOpen(date: Date): boolean {
  const day = date.getUTCDay() // 0 Sun … 6 Sat
  const hour = date.getUTCHours()
  if (day === 6) return false // Saturday
  if (day === 5 && hour >= 21) return false // Friday after NY close
  if (day === 0 && hour < 21) return false // Sunday before reopen
  return true
}

export function getSessionTag(date: Date): SessionTag {
  const hour = date.getUTCHours()
  const active = SESSIONS.filter((s) => inWindow(hour, s)).map((s) => s.name)

  if (active.includes('London') && active.includes('New York')) return 'london_ny_overlap'
  if (active.includes('Asia') && active.includes('London')) return 'asia_london_overlap'
  if (active.includes('London')) return 'london'
  if (active.includes('New York')) return 'newyork'
  if (active.includes('Asia')) return 'asia'
  return 'dead_zone'
}

const LIQUIDITY: Record<SessionTag, 'low' | 'medium' | 'high'> = {
  london_ny_overlap: 'high',
  london: 'high',
  newyork: 'medium',
  asia_london_overlap: 'medium',
  asia: 'low',
  dead_zone: 'low',
}

// Baseline quality score per session used by the scoring layer (0–100).
export const SESSION_QUALITY: Record<SessionTag, number> = {
  london_ny_overlap: 100,
  london: 85,
  newyork: 72,
  asia_london_overlap: 62,
  asia: 45,
  dead_zone: 15,
}

// UTC hours at which the session tag changes (session boundaries).
const BOUNDARIES = [7, 8, 12, 16, 21, 23]

export function getSessionInfo(date: Date = new Date()): SessionInfo {
  const tag = getSessionTag(date)
  const hour = date.getUTCHours()
  const minute = date.getUTCMinutes()
  const open = isMarketOpen(date)

  // minutes until the next boundary hour
  let minutesToNextChange = Infinity
  let nextBoundary = BOUNDARIES[0]
  for (const b of BOUNDARIES) {
    const deltaH = (b - hour + 24) % 24
    const mins = deltaH * 60 - minute
    if (mins > 0 && mins < minutesToNextChange) {
      minutesToNextChange = mins
      nextBoundary = b
    }
  }

  const boundaryLabel: Record<number, string> = {
    7: 'London open',
    8: 'Asia close',
    12: 'New York open',
    16: 'London close',
    21: 'New York close',
    23: 'Asia open',
  }

  const active = SESSIONS.filter((s) => inWindow(hour, s)).map((s) => s.name)

  return {
    tag,
    label: SESSION_LABELS[tag],
    activeSessions: open ? active : [],
    liquidity: open ? LIQUIDITY[tag] : 'low',
    marketOpen: open,
    minutesToNextChange: Number.isFinite(minutesToNextChange) ? minutesToNextChange : 0,
    nextChange: open
      ? `${boundaryLabel[nextBoundary]} in ${formatMinutes(minutesToNextChange)}`
      : 'Market closed until Sunday 21:00 UTC',
    utcHour: hour,
  }
}

function formatMinutes(mins: number): string {
  if (!Number.isFinite(mins)) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
