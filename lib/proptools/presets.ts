import type { ChallengeRules } from './challenge'

// Typical rule structures across the industry (FTMO-style 2-step, 1-step
// evaluations, instant funding). Firms tweak numbers per program — these are
// starting points; users must verify against their own firm's dashboard.

export interface ChallengePreset {
  id: string
  label: string
  rules: Omit<ChallengeRules, 'accountSize'>
}

export const CHALLENGE_PRESETS: ChallengePreset[] = [
  {
    id: '2-step-phase-1',
    label: '2-Step Evaluation — Phase 1 (typical: 8% target, 5% daily, 10% max)',
    rules: { profitTargetPct: 8, maxDailyLossPct: 5, maxTotalLossPct: 10 },
  },
  {
    id: '2-step-phase-2',
    label: '2-Step Evaluation — Phase 2 (typical: 5% target, 5% daily, 10% max)',
    rules: { profitTargetPct: 5, maxDailyLossPct: 5, maxTotalLossPct: 10 },
  },
  {
    id: '1-step',
    label: '1-Step Evaluation (typical: 10% target, 3% daily, 6% max)',
    rules: { profitTargetPct: 10, maxDailyLossPct: 3, maxTotalLossPct: 6 },
  },
  {
    id: 'funded',
    label: 'Funded Account (typical: no target, 5% daily, 10% max)',
    rules: { profitTargetPct: 0, maxDailyLossPct: 5, maxTotalLossPct: 10 },
  },
]

export const ACCOUNT_SIZES = [5_000, 10_000, 25_000, 50_000, 100_000, 200_000]
