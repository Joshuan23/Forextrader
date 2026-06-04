'use client'

import type { COTReport, COTPositionGroup } from '@/types/cot'

interface Props {
  cot: COTReport
}

const BIAS_CONFIG = {
  strongly_bullish: { label: 'Strongly Bullish', color: '#3fb950', bgColor: 'bg-[#1a3a1f]', borderColor: 'border-[#3fb950]' },
  bullish:          { label: 'Bullish',          color: '#56d364', bgColor: 'bg-[#1a3a1f]', borderColor: 'border-[#56d364]' },
  neutral:          { label: 'Neutral',           color: '#8b949e', bgColor: 'bg-[#1c2128]', borderColor: 'border-[#30363d]' },
  bearish:          { label: 'Bearish',           color: '#f85149', bgColor: 'bg-[#3a1a1a]', borderColor: 'border-[#f85149]' },
  strongly_bearish: { label: 'Strongly Bearish',  color: '#da3633', bgColor: 'bg-[#3a1a1a]', borderColor: 'border-[#da3633]' },
}

function ScoreBar({ score }: { score: number }) {
  // Score is -100 to +100; map to 0–100% position
  const pct = ((score + 100) / 200) * 100
  const isPositive = score > 0
  const color = score >= 15 ? '#3fb950' : score <= -15 ? '#f85149' : '#8b949e'

  return (
    <div className="relative">
      <div className="flex justify-between text-xs text-[#8b949e] mb-1">
        <span>Short</span>
        <span className="font-semibold" style={{ color }}>
          {score > 0 ? '+' : ''}{score}
        </span>
        <span>Long</span>
      </div>
      <div className="h-2 rounded-full bg-[#21262d] relative overflow-hidden">
        {/* Center marker */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-[#30363d]" />
        {/* Score needle */}
        <div
          className="absolute inset-y-0 w-1 rounded-full transition-all duration-500"
          style={{ left: `calc(${pct}% - 2px)`, backgroundColor: color }}
        />
        {/* Fill from center */}
        {isPositive ? (
          <div
            className="absolute inset-y-0 rounded-r-full opacity-30 transition-all duration-500"
            style={{ left: '50%', width: `${pct - 50}%`, backgroundColor: color }}
          />
        ) : (
          <div
            className="absolute inset-y-0 rounded-l-full opacity-30 transition-all duration-500"
            style={{ right: `${100 - pct}%`, left: `${pct}%`, backgroundColor: color }}
          />
        )}
      </div>
    </div>
  )
}

function GroupRow({ label, group }: { label: string; group: COTPositionGroup }) {
  const net = group.net
  const netColor = net > 0 ? '#3fb950' : net < 0 ? '#f85149' : '#8b949e'
  const changeNetColor = group.changeInNet > 0 ? '#3fb950' : group.changeInNet < 0 ? '#f85149' : '#8b949e'

  return (
    <div className="grid grid-cols-5 gap-1 text-xs py-1.5 border-b border-[#21262d] last:border-0">
      <div className="col-span-1 text-[#8b949e] truncate">{label}</div>
      <div className="text-center text-[#3fb950]">{group.long.toLocaleString()}</div>
      <div className="text-center text-[#f85149]">{group.short.toLocaleString()}</div>
      <div className="text-center font-semibold" style={{ color: netColor }}>
        {net > 0 ? '+' : ''}{net.toLocaleString()}
      </div>
      <div className="text-center text-xs" style={{ color: changeNetColor }}>
        {group.changeInNet > 0 ? '+' : ''}{group.changeInNet.toLocaleString()}
      </div>
    </div>
  )
}

export function COTPanel({ cot }: Props) {
  if (cot.source === 'unavailable') {
    return (
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">COT Report</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e]">Unavailable</span>
        </div>
        <p className="text-xs text-[#8b949e]">{cot.error ?? 'No CFTC data for this instrument'}</p>
      </div>
    )
  }

  const biasConf = BIAS_CONFIG[cot.institutionalBias]
  const groups: { label: string; group: COTPositionGroup }[] = []

  if (cot.source === 'tff') {
    if (cot.dealers)       groups.push({ label: 'Dealers', group: cot.dealers })
    if (cot.assetManagers) groups.push({ label: 'Asset Mgrs', group: cot.assetManagers })
    if (cot.leveragedFunds) groups.push({ label: 'Lev. Funds', group: cot.leveragedFunds })
  } else {
    if (cot.producers)    groups.push({ label: 'Producers', group: cot.producers })
    if (cot.swapDealers)  groups.push({ label: 'Swap Dlrs', group: cot.swapDealers })
    if (cot.managedMoney) groups.push({ label: 'Managed $', group: cot.managedMoney })
  }

  const primaryGroup = cot.source === 'tff' ? cot.assetManagers : cot.managedMoney
  const primaryLabel = cot.source === 'tff' ? 'Asset Managers' : 'Managed Money'

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">
            CFTC COT Report
          </span>
          {cot.asOfDate && (
            <span className="ml-2 text-xs text-[#484f58]">
              as of {cot.asOfDate}
            </span>
          )}
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded border font-semibold ${biasConf.bgColor} ${biasConf.borderColor}`}
          style={{ color: biasConf.color }}
        >
          {biasConf.label}
        </span>
      </div>

      {/* Institutional Score Bar */}
      <ScoreBar score={cot.institutionalScore} />

      {/* Primary driver note */}
      {primaryGroup && (
        <p className="text-xs text-[#8b949e]">
          Signal driven by{' '}
          <span className="text-[#c9d1d9] font-medium">{primaryLabel}</span>
          {' '}(net {primaryGroup.net > 0 ? '+' : ''}{primaryGroup.net.toLocaleString()} contracts
          {' '}/ OI: {cot.openInterest.toLocaleString()})
        </p>
      )}

      {/* Position table */}
      {groups.length > 0 && (
        <div>
          <div className="grid grid-cols-5 gap-1 text-xs text-[#484f58] pb-1 border-b border-[#30363d]">
            <div className="col-span-1">Trader</div>
            <div className="text-center">Long</div>
            <div className="text-center">Short</div>
            <div className="text-center">Net</div>
            <div className="text-center">Chg</div>
          </div>
          {groups.map(({ label, group }) => (
            <GroupRow key={label} label={label} group={group} />
          ))}
        </div>
      )}

      {/* Source badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#484f58]">Source: CFTC {cot.source === 'tff' ? 'TFF' : 'Disaggregated'}</span>
        <span className="text-xs text-[#484f58]">·</span>
        <span className="text-xs text-[#484f58]">Updated weekly (Fridays)</span>
      </div>
    </div>
  )
}
