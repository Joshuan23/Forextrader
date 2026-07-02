import type { Metadata } from 'next'
import Link from 'next/link'
import { ToolsShell } from '@/components/tools/ToolsShell'
import { ChallengeCalculator } from '@/components/tools/ChallengeCalculator'
import { ToolCTA } from '@/components/tools/ToolCTA'

export const metadata: Metadata = {
  title: 'Prop Firm Drawdown Calculator — Daily Loss & Max Drawdown (Free)',
  description:
    'Free prop-firm drawdown calculator for challenge and funded accounts. See exactly how far your equity is from the daily loss limit and max drawdown, plus a safe risk-per-trade suggestion.',
}

const faq = [
  {
    q: 'What is the difference between daily loss limit and max drawdown?',
    a: 'The daily loss limit resets every trading day and is measured from your equity (or balance, firm-dependent) at the start of the day — typically 5% of the initial account. Max drawdown is a hard floor below the initial balance, typically 10%, and never resets. Breaching either one fails the account instantly.',
  },
  {
    q: 'How much should I risk per trade in a prop-firm challenge?',
    a: 'A common rule: never risk more than a third of your remaining room to the nearest limit, so three consecutive losses still leave you alive. With a fresh $100k account and a 5% daily limit, that means at most ~$1,600 (1.6%) per trade — and most consistent challenge passers stay at 0.5–1%.',
  },
  {
    q: 'Does this work for FTMO, FundedNext, and other firms?',
    a: 'Yes — the presets cover the typical 2-step (8%/5%/10%), 1-step, and funded-account rule structures used across the industry. Every firm tweaks the numbers and measurement method (balance vs equity, static vs trailing), so always verify against your firm’s official dashboard.',
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

export default function DrawdownCalculatorPage() {
  return (
    <ToolsShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-3xl font-bold text-[#e6edf3] mb-2">Prop firm drawdown calculator</h1>
      <p className="text-[#8b949e] mb-8">
        Most challenges are lost to rule violations, not bad trading. Enter your account state and
        see exactly how much room you have before the daily loss limit or max drawdown fails you —
        and how much you can safely risk on the next trade.
      </p>

      <ChallengeCalculator />

      <section className="mt-10 space-y-6 text-sm text-[#8b949e] leading-relaxed">
        {faq.map(({ q, a }) => (
          <div key={q}>
            <h2 className="text-lg font-semibold text-[#e6edf3] mb-2">{q}</h2>
            <p>{a}</p>
          </div>
        ))}
        <p>
          Once you know your dollar risk budget, use the{' '}
          <Link href="/tools/position-size-calculator" className="text-[#58a6ff] hover:underline">
            position size calculator
          </Link>{' '}
          to convert it into an exact lot size for the pair you&apos;re trading.
        </p>
      </section>

      <ToolCTA />
    </ToolsShell>
  )
}
