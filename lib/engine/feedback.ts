import type { JournalRecord } from './expectancy'
import type { HistoricalEdge, SessionTag, SetupType } from './types'
import {
  EDGE_BLOCK_EXPECTANCY,
  EDGE_BLOCK_SAMPLE,
  EDGE_BOOST,
  EDGE_MIN_SAMPLE,
  EDGE_PENALTY,
} from './config'

// Review/expectancy layer: realised journal performance feeds back into
// live scoring. A setup that has proven itself in a given session gets a
// confidence boost; one that reliably bleeds gets penalised or blocked.

export type EdgeMap = Map<string, HistoricalEdge>

export function edgeKey(setupType: SetupType, sessionTag: SessionTag): string {
  return `${setupType}|${sessionTag}`
}

export function buildEdgeMap(entries: JournalRecord[]): EdgeMap {
  const groups = new Map<string, number[]>()
  for (const e of entries) {
    if (!e.taken || typeof e.resultR !== 'number') continue
    const key = edgeKey(e.setupType, e.sessionTag)
    const list = groups.get(key) ?? []
    list.push(e.resultR)
    groups.set(key, list)
  }

  const map: EdgeMap = new Map()
  for (const [key, rs] of groups) {
    const trades = rs.length
    const expectancyR = Math.round((rs.reduce((a, b) => a + b, 0) / trades) * 100) / 100

    let adjustment = 0
    let blocked = false
    let note = `Historical edge: ${trades} trades, ${fmtR(expectancyR)} expectancy`
    if (trades >= EDGE_BLOCK_SAMPLE && expectancyR <= EDGE_BLOCK_EXPECTANCY) {
      blocked = true
      note = `Historically toxic: ${fmtR(expectancyR)} over ${trades} trades in this session — blocked by expectancy layer`
    } else if (trades >= EDGE_MIN_SAMPLE && expectancyR >= 0.2) {
      adjustment = EDGE_BOOST
      note = `Proven edge: ${fmtR(expectancyR)} over ${trades} trades — confidence +${EDGE_BOOST}`
    } else if (trades >= EDGE_MIN_SAMPLE && expectancyR <= -0.15) {
      adjustment = EDGE_PENALTY
      note = `Negative expectancy: ${fmtR(expectancyR)} over ${trades} trades — confidence ${EDGE_PENALTY}`
    } else if (trades < EDGE_MIN_SAMPLE) {
      note = `Insufficient sample (${trades} trades) — no adjustment`
    }

    map.set(key, { key, trades, expectancyR, adjustment, blocked, note })
  }
  return map
}

export function lookupEdge(
  map: EdgeMap,
  setupType: SetupType,
  sessionTag: SessionTag
): HistoricalEdge | undefined {
  return map.get(edgeKey(setupType, sessionTag))
}

function fmtR(r: number): string {
  return `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`
}
