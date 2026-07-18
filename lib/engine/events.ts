import { fetchCalendarEvents } from '@/lib/data/economic-calendar'
import type { EconomicEventLite, EventRisk, FlowEdgeSettings } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

export interface CalendarContext {
  events: EconomicEventLite[]
  now: number
}

// Fetch once per scan and share across pairs.
export async function loadCalendarContext(now = Date.now()): Promise<CalendarContext> {
  const events = await fetchCalendarEvents(now - 6 * 60 * 60 * 1000, now + 3 * DAY_MS)
  return { events, now }
}

function currenciesOf(symbol: string): string[] {
  const [base, quote] = symbol.split('/')
  // Metals/indices: only the quote currency (USD) drives event risk.
  const ccys = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']
  return [base, quote].filter((c) => c && ccys.includes(c))
}

// Evaluate the macro/event layer for one pair.
export function evaluateEventRisk(
  symbol: string,
  ctx: CalendarContext,
  settings: FlowEdgeSettings
): EventRisk {
  const { now } = ctx
  const ccys = currenciesOf(symbol)
  const relevant = ctx.events.filter((e) => ccys.includes(e.currency))

  const dayStart = new Date(now)
  dayStart.setUTCHours(0, 0, 0, 0)
  const todaysEvents = relevant.filter(
    (e) => e.scheduledAt >= dayStart.getTime() && e.scheduledAt < dayStart.getTime() + DAY_MS
  )

  const centralBankDay = todaysEvents.some((e) => e.isCentralBank && e.impact === 'high')

  // Blackout: no new risk within [before, after] of a high-impact print.
  const beforeMs = settings.newsBlackoutBeforeMin * 60 * 1000
  const afterMs = settings.newsBlackoutAfterMin * 60 * 1000
  let inBlackout = false
  let blackoutReason: string | undefined
  for (const e of relevant) {
    if (e.impact !== 'high') continue
    if (now >= e.scheduledAt - beforeMs && now <= e.scheduledAt + afterMs) {
      inBlackout = true
      const mins = Math.round((e.scheduledAt - now) / 60000)
      blackoutReason =
        mins >= 0
          ? `${e.title} (${e.currency}) in ${mins}m — inside ${settings.newsBlackoutBeforeMin}m pre-news blackout`
          : `${e.title} (${e.currency}) released ${-mins}m ago — inside ${settings.newsBlackoutAfterMin}m post-news blackout`
      break
    }
  }

  // Next high-impact event for the pair.
  const upcomingHigh = relevant
    .filter((e) => e.impact === 'high' && e.scheduledAt > now)
    .sort((a, b) => a.scheduledAt - b.scheduledAt)[0]
  const nextHighImpact = upcomingHigh
    ? { ...upcomingHigh, minutesTo: Math.round((upcomingHigh.scheduledAt - now) / 60000) }
    : undefined

  // Macro risk level.
  let level: EventRisk['level'] = 'low'
  if (inBlackout || (nextHighImpact && nextHighImpact.minutesTo <= 120)) level = 'high'
  else if (
    centralBankDay ||
    (nextHighImpact && nextHighImpact.minutesTo <= 8 * 60) ||
    relevant.some(
      (e) => e.impact === 'medium' && Math.abs(e.scheduledAt - now) <= 60 * 60 * 1000
    )
  )
    level = 'medium'

  return { level, inBlackout, blackoutReason, centralBankDay, nextHighImpact, todaysEvents }
}

// 0–100 score for the event layer.
// blackout → 0 · high risk (high-impact ≤ 120m away) → 35 · medium
// (CB day, high-impact ≤ 8h, or medium-impact within ±60m) → 65 · low → 100.
// Central-bank day additionally caps the score at 55 when the toggle is on.
export function eventRiskScore(
  risk: EventRisk,
  settings: FlowEdgeSettings
): { score: number; note: string; rule: string } {
  if (risk.inBlackout) {
    return {
      score: 0,
      note: risk.blackoutReason ?? 'News blackout window',
      rule: `inside blackout window (${settings.newsBlackoutBeforeMin}m before / ${settings.newsBlackoutAfterMin}m after high-impact) → 0`,
    }
  }
  let score = 100
  const notes: string[] = []
  const ruleParts: string[] = []
  if (risk.level === 'high') {
    score = 35
    notes.push('High-impact event approaching')
    ruleParts.push(
      `high risk (${risk.nextHighImpact ? `${risk.nextHighImpact.title} in ${risk.nextHighImpact.minutesTo}m ≤ 120m` : 'high-impact imminent'}) → 35`
    )
  } else if (risk.level === 'medium') {
    score = 65
    notes.push('Elevated event risk today')
    ruleParts.push('medium risk (CB day, high-impact ≤ 8h, or medium-impact ±60m) → 65')
  } else {
    ruleParts.push('no qualifying events → 100')
  }
  if (risk.centralBankDay && settings.centralBankDowngrade) {
    score = Math.min(score, 55)
    notes.push('Central bank day — signals downweighted')
    ruleParts.push('central-bank day cap → min(score, 55)')
  }
  return { score, note: notes.join('; ') || 'No material event risk', rule: ruleParts.join('; ') + ` = ${score}` }
}
