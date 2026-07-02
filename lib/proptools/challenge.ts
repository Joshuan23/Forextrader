// Prop-firm challenge math: given a firm's rules and the trader's current
// equity, compute distance to every violation threshold and to the profit
// target. All rules are % of initial account size (static drawdown model,
// the structure used by most 2-step evaluations).

export interface ChallengeRules {
  accountSize: number       // initial challenge balance, USD
  profitTargetPct: number   // e.g. 8 → pass at accountSize * 1.08
  maxDailyLossPct: number   // e.g. 5 → violated if equity drops 5% below day-start
  maxTotalLossPct: number   // e.g. 10 → violated if equity drops 10% below initial
}

export interface ChallengeSnapshot {
  equity: number            // current account equity
  dayStartEquity: number    // equity at the start of the current trading day
}

export type ChallengeStatus =
  | 'passed'
  | 'violated-total'
  | 'violated-daily'
  | 'danger'    // less than 1/3 of a limit remaining
  | 'caution'   // less than 2/3 of a limit remaining
  | 'on-track'

export interface ChallengeEvaluation {
  status: ChallengeStatus
  targetEquity: number        // equity needed to pass
  dailyLossFloor: number      // equity at which the daily rule is violated
  totalLossFloor: number      // equity at which the account is failed
  remainingDaily: number      // USD of losses left before daily violation
  remainingTotal: number      // USD of losses left before total violation
  distanceToTarget: number    // USD of profit still needed (0 if passed)
  progressPct: number         // 0–100 progress from start toward target
  bindingLimit: 'daily' | 'total'
  suggestedRiskUsd: number    // risk per trade that survives 3 straight losses
}

export function evaluateChallenge(rules: ChallengeRules, snap: ChallengeSnapshot): ChallengeEvaluation {
  const { accountSize, profitTargetPct, maxDailyLossPct, maxTotalLossPct } = rules

  const hasTarget = profitTargetPct > 0
  const targetEquity = accountSize * (1 + profitTargetPct / 100)
  const dailyLossFloor = snap.dayStartEquity - accountSize * (maxDailyLossPct / 100)
  const totalLossFloor = accountSize * (1 - maxTotalLossPct / 100)

  const remainingDaily = Math.max(0, snap.equity - dailyLossFloor)
  const remainingTotal = Math.max(0, snap.equity - totalLossFloor)
  const distanceToTarget = hasTarget ? Math.max(0, targetEquity - snap.equity) : 0

  const gained = snap.equity - accountSize
  const targetGain = targetEquity - accountSize
  const progressPct = hasTarget
    ? Math.min(100, Math.max(0, (gained / targetGain) * 100))
    : 100

  const bindingLimit = remainingDaily <= remainingTotal ? 'daily' : 'total'
  const binding = Math.min(remainingDaily, remainingTotal)
  const bindingCap = Math.min(
    accountSize * (maxDailyLossPct / 100),
    accountSize * (maxTotalLossPct / 100),
  )

  let status: ChallengeStatus
  if (snap.equity <= totalLossFloor) status = 'violated-total'
  else if (snap.equity <= dailyLossFloor) status = 'violated-daily'
  else if (hasTarget && snap.equity >= targetEquity) status = 'passed'
  else if (binding < bindingCap / 3) status = 'danger'
  else if (binding < (bindingCap * 2) / 3) status = 'caution'
  else status = 'on-track'

  return {
    status,
    targetEquity,
    dailyLossFloor,
    totalLossFloor,
    remainingDaily,
    remainingTotal,
    distanceToTarget,
    progressPct,
    bindingLimit,
    suggestedRiskUsd: binding / 3,
  }
}
