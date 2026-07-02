import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ToolsShell } from '@/components/tools/ToolsShell'
import { PositionSizeCalculator } from '@/components/tools/PositionSizeCalculator'
import { ToolCTA } from '@/components/tools/ToolCTA'
import { CURRENCY_PAIRS, getPairBySlug, pairSlug } from '@/lib/forex/pairs'
import { calcPositionSize, pipValuePerLot } from '@/lib/proptools/positionSize'

interface Props {
  params: { pair: string }
}

export function generateStaticParams() {
  return CURRENCY_PAIRS.map(p => ({ pair: pairSlug(p.symbol) }))
}

export function generateMetadata({ params }: Props): Metadata {
  const pair = getPairBySlug(params.pair)
  if (!pair) return {}
  return {
    title: `${pair.symbol} Position Size Calculator — Lot Size & Pip Value (Free)`,
    description: `Free ${pair.symbol} (${pair.name}) position size calculator. Exact lot size from your account balance, risk % and stop-loss in pips, with live ${pair.symbol} pip value.`,
  }
}

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export default function PairPositionSizePage({ params }: Props) {
  const pair = getPairBySlug(params.pair)
  if (!pair) notFound()

  const pipValue = pipValuePerLot(pair, pair.basePrice)
  const example = calcPositionSize({
    accountSize: 10_000,
    riskPct: 1,
    stopPips: 20,
    pair,
    price: pair.basePrice,
  })

  const faq = [
    {
      q: `What is one pip on ${pair.symbol}?`,
      a: `${pair.symbol} is quoted to ${pair.digits} decimal place${pair.digits === 1 ? '' : 's'}, and one pip is a move of ${pair.pipSize}. Per standard lot, one pip is worth roughly $${fmt(pipValue)} (it varies slightly with the ${pair.quote === 'USD' ? 'contract convention' : `${pair.quote} exchange rate`}).`,
    },
    {
      q: `How many lots of ${pair.symbol} should I trade?`,
      a: `Divide your dollar risk by (stop-loss pips × pip value). Example: risking 1% of a $10,000 account ($100) with a 20-pip stop on ${pair.symbol} gives ${fmt(example.lots)} lots (${example.units.toLocaleString('en-US')} units).`,
    },
    {
      q: `What lot size is safe for a prop-firm challenge on ${pair.symbol}?`,
      a: `Most 2-step evaluations allow a 5% daily loss and 10% max drawdown. Risking 0.5–1% per trade keeps you at least five consecutive losing trades away from a daily violation. Use the drawdown calculator to see your exact remaining room.`,
    },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const others = CURRENCY_PAIRS.filter(p => p.symbol !== pair.symbol)

  return (
    <ToolsShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-3xl font-bold text-[#e6edf3] mb-2">
        {pair.symbol} position size calculator
      </h1>
      <p className="text-[#8b949e] mb-8">
        Exact lot size for {pair.name} ({pair.symbol}) from your account balance, risk percentage
        and stop-loss distance — with pip value computed at the current price.
      </p>

      <PositionSizeCalculator initialSymbol={pair.symbol} />

      <section className="mt-10 space-y-6 text-sm text-[#8b949e] leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-[#e6edf3] mb-2">
            {pair.symbol} contract facts
          </h2>
          <ul className="space-y-1.5">
            <li>• One pip = a {pair.pipSize} move ({pair.digits}-decimal pricing)</li>
            <li>• Pip value ≈ ${fmt(pipValue)} per standard lot</li>
            <li>• Typical spread ≈ {pair.spread} pips</li>
            <li>
              • Example: $10,000 account, 1% risk, 20-pip stop → {fmt(example.lots)} lots
              (${fmt(example.usdPerPip)}/pip)
            </li>
          </ul>
        </div>

        {faq.map(({ q, a }) => (
          <div key={q}>
            <h2 className="text-lg font-semibold text-[#e6edf3] mb-2">{q}</h2>
            <p>{a}</p>
          </div>
        ))}

        <div>
          <h2 className="text-lg font-semibold text-[#e6edf3] mb-2">Other markets</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {others.map(p => (
              <Link
                key={p.symbol}
                href={`/tools/position-size-calculator/${pairSlug(p.symbol)}`}
                className="px-3 py-1.5 bg-[#161b22] border border-[#21262d] hover:border-[#58a6ff]/50 rounded-lg text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
              >
                {p.symbol}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ToolCTA />
    </ToolsShell>
  )
}
