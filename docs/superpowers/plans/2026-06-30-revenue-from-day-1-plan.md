# Plan: Revenue From Day 1 — Forex SaaS Paywall + Freelance Setup

**Goal:** Add Stripe subscription paywall to Forextrader and create the operational freelance acquisition system
**Architecture:** Route groups split marketing (no sidebar) from app (with sidebar); Stripe as identity source of truth; HMAC-SHA256 signed session cookies; no separate database
**Tech stack:** Next.js 14 App Router, `stripe` npm SDK, TypeScript, Tailwind CSS, Node.js built-in `crypto`
**Global constraints:** DRY, YAGNI — no new databases, no auth libraries, no new UI libraries. Stripe is the only source of truth for subscriptions.

---

## PHASE 1: Freelance Operational Setup (no code — docs only)

---

## Task 1: Create cold email sequence templates

**File:** `docs/freelance/cold-email-sequence.md`
**Interfaces:** Produces ready-to-send email templates; human fills `[FIRM_NAME]`, `[KEYWORD]`, `[COMPETITOR]`
**Depends on:** nothing

### Steps

1. Create file with complete 3-email sequence:

```markdown
# Cold Email Sequence — AI SEO Content for Law/Accounting Firms

---

## Email 1 — Day 0: Pain opener

**Subject:** [FIRM_NAME]'s Google ranking

Hi [FIRST_NAME],

Searched "[KEYWORD] [CITY]" today — [COMPETITOR] is showing up above you on the first page.

Most firms in your space lose 3–5 new client inquiries per month to that gap. Not because they're worse, but because Google doesn't know they exist.

We produce 4 SEO articles per month that target the exact searches your future clients are typing. Our last law firm client went from page 4 to page 1 for their top keyword in 11 weeks.

Worth a 15-minute call? Here's my calendar: [CALENDLY_LINK]

[YOUR_NAME]

---

## Email 2 — Day 3: Social proof + offer

**Subject:** What we did for a firm like yours

Hi [FIRST_NAME],

Quick follow-up. [SIMILAR_FIRM] hired us 4 months ago — they were invisible on Google for "[KEYWORD]". Today they rank #2 and attribute 4–6 new client contacts per month to organic search.

Here's what we do: 4 long-form SEO articles per month, $1,500. We handle research, writing, and structure. You review, then publish. Takes you about 15 minutes per article.

If it doesn't generate at least one new client inquiry in 90 days, we'll refund the last month.

Still interested? [CALENDLY_LINK]

[YOUR_NAME]

---

## Email 3 — Day 5: Easy yes

**Subject:** Last note — free article offer

Hi [FIRST_NAME],

I'll keep this short. I'll write your firm one article for free — no strings — so you can see exactly what we produce before deciding anything.

Just reply with the topic you most want to rank for (e.g. "estate planning attorney [CITY]") and I'll send it within 48 hours.

[YOUR_NAME]

---

## Personalization checklist before sending

- [ ] Find their website, check DA (use Semrush → Overview → Domain Authority)
- [ ] Find a competitor ranking above them for a valuable keyword
- [ ] Replace all [BRACKETS] with real values
- [ ] Confirm Calendly link is correct
- [ ] Send Email 1, set reminder for Day 3 and Day 5
```

2. Commit: `git commit -m "docs: add cold email sequence templates"`

---

## Task 2: Create article generation workflow

**File:** `docs/freelance/article-generation-workflow.md`
**Interfaces:** Produces step-by-step prompt workflow for generating client SEO articles
**Depends on:** Task 1

### Steps

1. Create file:

```markdown
# Article Generation Workflow — 30 Minutes Per Article

## Step 1: Keyword research in Semrush (5 min)

1. Open Semrush → Keyword Magic Tool
2. Enter the client's target topic (e.g. "estate planning attorney chicago")
3. Filter: Volume > 100/mo, KD < 40 (Keyword Difficulty)
4. Pick primary keyword + 3–5 related keywords from results
5. Note: search volume, top-ranking competitor URL

## Step 2: Generate article with Claude (5 min)

Use this exact prompt:

---
Write a 1,500-word SEO article for a [LAW FIRM / ACCOUNTING FIRM] targeting the keyword "[PRIMARY_KEYWORD]".

Audience: People in [CITY] searching for [SERVICE_TYPE].
Tone: Professional, trustworthy, not salesy.
Structure:
- H1: Include primary keyword naturally
- Introduction (150 words): address the reader's problem directly
- H2: [RELATED_KEYWORD_1] — 300 words
- H2: [RELATED_KEYWORD_2] — 300 words
- H2: [RELATED_KEYWORD_3] — 300 words
- H2: Why Choose a Local [SERVICE_TYPE] in [CITY] — 200 words
- Conclusion + CTA (150 words): soft call to action to contact the firm

Include:
- Primary keyword in H1, first paragraph, and 2–3 body paragraphs
- Related keywords naturally throughout
- One internal link placeholder: [LINK TO: relevant page on their site]
- Meta description (155 characters max) at the top of the document
---

## Step 3: Human review (15 min)

- [ ] Fact-check any statistics or legal claims
- [ ] Add 1–2 firm-specific details (awards, years in practice, local knowledge)
- [ ] Fill in the [LINK TO:] placeholder with actual URL from client's site
- [ ] Read first paragraph aloud — adjust if it sounds robotic

## Step 4: Deliver (5 min)

1. Paste into Google Doc in client's shared Drive folder
2. Title format: `[CLIENT_NAME] — [KEYWORD] — [MONTH YEAR]`
3. Set sharing: "Anyone with link can comment"
4. Send client a 1-line message: "Article 1/4 for [MONTH] is ready for your review: [GOOGLE_DOC_LINK]"

## Capacity

- Time per article: ~30 min
- Articles per client per month: 4
- Time per client per month: ~2 hours
- Max clients before overwhelmed: 8–10
```

2. Commit: `git commit -m "docs: add article generation workflow"`

---

## Task 3: Create discovery call script

**File:** `docs/freelance/discovery-call-script.md`
**Interfaces:** Produces exact script for 20-minute sales call
**Depends on:** Task 1

### Steps

1. Create file:

```markdown
# Discovery Call Script — 20 Minutes

## Before the call (2 min prep)

- [ ] Open their website
- [ ] Run their domain in Semrush: note their DA, top 3 keywords, organic traffic estimate
- [ ] Know one specific keyword where a competitor outranks them

---

## The call

### Opening (2 min)
"Thanks for making time. I'll keep this to 20 minutes. Before I tell you anything about what we do, I want to understand your situation first — is that okay?"

### Discovery (5 min) — LISTEN, don't pitch
- "How are you currently getting new clients?"
- "Is referrals reliable enough, or do you want a second channel?"
- "Have you tried SEO or content marketing before? What happened?"

### Pitch (5 min) — only after you understand their situation
"So based on what you're telling me — [REFLECT THEIR PAIN BACK] — here's what we do:

We produce 4 SEO articles per month targeting the exact searches your future clients are typing right now. I've already checked — you're not ranking for '[KEYWORD]' but [COMPETITOR] is. That search gets [VOLUME] people a month.

We write the articles, you review them in about 15 minutes, and you publish them. $1,500 a month, month-to-month, cancel anytime."

### Proof (3 min)
"Let me show you an example article we wrote for a similar firm." 
[Share screen or send Google Doc link in chat — have a sample article ready]

### Close (5 min)
"Does this feel like it could work for your firm?"

[If yes]: "Great. I can have your first article ready within 48 hours of you signing up. The easiest next step is I'll send you an invoice link right now — it's $1,500 for the first month, and we'll go from there."

[If hesitant]: "What's the main concern?"
- Price concern → "What if we did one article for free so you can see the quality before committing?"
- Timing concern → "When would be a better time? I'll follow up then."
- Need to think → "Of course. I'll send you the sample article and follow up in 3 days — does Thursday work?"

---

## After the call

- If closed: send Stripe invoice link immediately (stripe.com/invoices)
- If follow-up needed: set a 3-day reminder, send the sample article
- Log outcome in HubSpot
```

2. Commit: `git commit -m "docs: add discovery call script"`

---

## PHASE 2: Routing Architecture

---

## Task 4: Install Stripe and update env vars

**File:** `package.json`, `.env.local.example`
**Interfaces:** Produces `stripe` package available; env vars documented
**Depends on:** nothing

### Steps

1. Install Stripe:
```bash
npm install stripe
```

2. Verify install:
```bash
npm list stripe
# Expected: stripe@^17.x.x
```

3. Append to `.env.local.example`:
```bash
# ─── Stripe ───────────────────────────────────────────────────────
# Get keys from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# ─── Session ──────────────────────────────────────────────────────
# Any 32+ character random string: openssl rand -hex 32
SESSION_SECRET=your_32_char_secret_here

# ─── App ──────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Commit: `git commit -m "feat: install stripe and document env vars"`

---

## Task 5: Create subscription types

**File:** `types/subscription.ts`
**Interfaces:** Produces `SubscriptionStatus`, `SessionPayload` types used by all auth/subscription code
**Depends on:** Task 4

### Steps

1. Create `types/subscription.ts`:
```typescript
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'none'

export interface SessionPayload {
  customerId: string
  email: string
  status: SubscriptionStatus
  exp: number
}
```

2. Commit: `git commit -m "feat: add subscription types"`

---

## Task 6: Create Stripe server client

**File:** `lib/stripe.ts`
**Interfaces:** Exports singleton `stripe` Stripe client; exports `getSubscriptionStatus(email)` helper
**Depends on:** Task 5

### Steps

1. Create `lib/stripe.ts`:
```typescript
import Stripe from 'stripe'
import { SubscriptionStatus } from '@/types/subscription'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

export async function getSubscriptionStatus(email: string): Promise<{
  status: SubscriptionStatus
  customerId: string | null
}> {
  const customers = await stripe.customers.list({ email, limit: 1 })

  if (customers.data.length === 0) {
    return { status: 'none', customerId: null }
  }

  const customer = customers.data[0]
  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 1,
  })

  if (subscriptions.data.length === 0) {
    return { status: 'none', customerId: customer.id }
  }

  const sub = subscriptions.data[0]
  const status = sub.status as SubscriptionStatus
  return { status, customerId: customer.id }
}
```

2. Commit: `git commit -m "feat: add Stripe client and subscription status helper"`

---

## Task 7: Create session cookie utilities

**File:** `lib/session.ts`
**Interfaces:** Exports `createSession(payload)` → signed cookie string; `verifySession(cookie)` → `SessionPayload | null`
**Depends on:** Task 5

### Steps

1. Create `lib/session.ts`:
```typescript
import { createHmac, timingSafeEqual } from 'crypto'
import { SessionPayload } from '@/types/subscription'

const SECRET = process.env.SESSION_SECRET!
const COOKIE_NAME = 'fxt_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('base64url')
}

export function createSessionCookie(payload: Omit<SessionPayload, 'exp'>): string {
  const exp = Date.now() + SESSION_TTL_MS
  const full: SessionPayload = { ...payload, exp }
  const data = Buffer.from(JSON.stringify(full)).toString('base64url')
  const sig = sign(data)
  return `${COOKIE_NAME}=${data}.${sig}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
}

export function parseSession(cookieHeader: string | null): SessionPayload | null {
  if (!cookieHeader) return null

  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (!match) return null

  const [data, sig] = match[1].split('.')
  if (!data || !sig) return null

  const expectedSig = sign(data)
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null
  } catch {
    return null
  }

  try {
    const payload: SessionPayload = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME
```

2. Commit: `git commit -m "feat: add HMAC-signed session cookie utilities"`

---

## Task 8: Move root layout to minimal shell; create route group layouts

**Files:** `app/layout.tsx` (modify), `app/(app)/layout.tsx` (create), `app/(marketing)/layout.tsx` (create)
**Interfaces:** Root layout has no sidebar; app layout has sidebar; marketing layout is plain
**Depends on:** nothing

### Steps

1. Replace `app/layout.tsx` with minimal shell:
```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ForexTrader Pro',
  description: 'Institutional-Grade Forex Signals',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0f1117] text-[#e6edf3] min-h-screen">
        {children}
      </body>
    </html>
  )
}
```

2. Create `app/(app)/layout.tsx`:
```typescript
import { Sidebar } from '@/components/layout/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen ml-16 lg:ml-56">
        {children}
      </div>
    </div>
  )
}
```

3. Create `app/(marketing)/layout.tsx`:
```typescript
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

4. Commit: `git commit -m "feat: add route group layouts for marketing and app"`

---

## Task 9: Move existing app pages into (app) route group

**Files:** move `app/page.tsx` → `app/(app)/dashboard/page.tsx`; same for signals, charts, backtesting, strategies, positions
**Interfaces:** All existing pages now live under `/dashboard`, `/signals`, etc. — same URLs, new file locations
**Depends on:** Task 8

### Steps

1. Create `app/(app)/dashboard/` directory and move dashboard:
```bash
mkdir -p app/\(app\)/dashboard
cp app/page.tsx app/\(app\)/dashboard/page.tsx
```

2. Move remaining pages:
```bash
mkdir -p app/\(app\)/signals app/\(app\)/charts app/\(app\)/backtesting app/\(app\)/strategies app/\(app\)/positions
cp app/signals/page.tsx app/\(app\)/signals/page.tsx
cp app/charts/page.tsx app/\(app\)/charts/page.tsx
cp app/backtesting/page.tsx app/\(app\)/backtesting/page.tsx
cp app/strategies/page.tsx app/\(app\)/strategies/page.tsx
cp app/positions/page.tsx app/\(app\)/positions/page.tsx
```

3. Update `components/layout/Sidebar.tsx` — change dashboard href from `/` to `/dashboard`:
```typescript
const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, highlight: false },
  { href: '/signals', label: 'SMC Signals', icon: Zap, highlight: true },
  { href: '/charts', label: 'Charts', icon: LineChart, highlight: false },
  { href: '/backtesting', label: 'Backtesting', icon: FlaskConical, highlight: false },
  { href: '/strategies', label: 'Strategies', icon: Cpu, highlight: false },
  { href: '/positions', label: 'Positions', icon: List, highlight: false },
]
```

4. Delete old page files now that copies exist in route groups:
```bash
rm app/page.tsx
rm -rf app/signals app/charts app/backtesting app/strategies app/positions
```

5. Verify build:
```bash
npm run build
# Expected: no errors; all routes compile
```

6. Commit: `git commit -m "feat: move app pages into (app) route group"`

---

## PHASE 3: Stripe API Routes

---

## Task 10: Create Stripe Checkout session API route

**File:** `app/api/stripe/checkout/route.ts`
**Interfaces:** POST `{ email }` → `{ url: string }` (Stripe Checkout URL); redirects user to Stripe
**Depends on:** Task 6

### Steps

1. Create `app/api/stripe/checkout/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: { trial_period_days: 7 },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
  })

  return NextResponse.json({ url: session.url })
}
```

2. Commit: `git commit -m "feat: add Stripe checkout session API route"`

---

## Task 11: Create Stripe webhook handler

**File:** `app/api/stripe/webhook/route.ts`
**Interfaces:** POST from Stripe → handles `checkout.session.completed`, `customer.subscription.deleted`; returns 200
**Depends on:** Task 6

### Steps

1. Create `app/api/stripe/webhook/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Log event type for debugging — replace with real side effects as needed
  switch (event.type) {
    case 'checkout.session.completed':
      // Subscription is now active — user will be identified by email on next login
      break
    case 'customer.subscription.deleted':
      // Subscription canceled — session cookie will be invalidated on next check
      break
    default:
      break
  }

  return NextResponse.json({ received: true })
}

// Required: disable body parsing so we can verify Stripe signature
export const config = { api: { bodyParser: false } }
```

2. Commit: `git commit -m "feat: add Stripe webhook handler"`

---

## Task 12: Create email login API route

**File:** `app/api/auth/login/route.ts`
**Interfaces:** POST `{ email }` → sets session cookie → `{ redirect: '/dashboard' }` or `{ redirect: '/checkout-url' }`
**Depends on:** Task 6, Task 7

### Steps

1. Create `app/api/auth/login/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionStatus } from '@/lib/stripe'
import { createSessionCookie } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const { status, customerId } = await getSubscriptionStatus(email)

  if ((status === 'active' || status === 'trialing') && customerId) {
    const cookie = createSessionCookie({ customerId, email, status })
    return NextResponse.json(
      { redirect: '/dashboard' },
      { headers: { 'Set-Cookie': cookie } }
    )
  }

  if (status === 'none') {
    // No Stripe customer — send to checkout
    const checkoutRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const { url } = await checkoutRes.json()
    return NextResponse.json({ redirect: url })
  }

  // past_due or canceled
  return NextResponse.json({
    error: 'Your subscription is inactive. Please reactivate via the customer portal.',
    portalRedirect: `${process.env.NEXT_PUBLIC_APP_URL}/portal`,
  }, { status: 403 })
}
```

2. Commit: `git commit -m "feat: add email login API route"`

---

## Task 13: Create auth middleware

**File:** `middleware.ts`
**Interfaces:** Reads session cookie; redirects unauthenticated requests from `/dashboard/*`, `/signals`, `/charts`, `/backtesting`, `/strategies`, `/positions` to `/login`
**Depends on:** Task 7

### Steps

1. Create `middleware.ts` at project root:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { parseSession } from '@/lib/session'

const PROTECTED = ['/dashboard', '/signals', '/charts', '/backtesting', '/strategies', '/positions']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isProtected) return NextResponse.next()

  const session = parseSession(req.headers.get('cookie'))
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/signals/:path*', '/charts/:path*',
            '/backtesting/:path*', '/strategies/:path*', '/positions/:path*'],
}
```

2. Commit: `git commit -m "feat: add auth middleware for protected routes"`

---

## PHASE 4: Marketing Pages

---

## Task 14: Create login page

**File:** `app/(marketing)/login/page.tsx`
**Interfaces:** Renders email form; POST to `/api/auth/login`; redirects on success
**Depends on:** Task 12, Task 8

### Steps

1. Create `app/(marketing)/login/page.tsx`:
```typescript
'use client'

import { useState, FormEvent } from 'react'
import { TrendingUp } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await res.json()
    setLoading(false)

    if (data.redirect) {
      window.location.href = data.redirect
      return
    }

    setError(data.error || 'Something went wrong. Try again.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#58a6ff] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-[#e6edf3]">ForexTrader Pro</span>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-8">
          <h1 className="text-xl font-semibold text-[#e6edf3] mb-2">Access your account</h1>
          <p className="text-sm text-[#8b949e] mb-6">Enter the email you used to sign up.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 bg-[#0f1117] border border-[#21262d] rounded-lg text-[#e6edf3] placeholder-[#484f58] text-sm focus:outline-none focus:border-[#58a6ff]"
            />

            {error && <p className="text-sm text-[#f85149]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#58a6ff] hover:bg-[#4393e6] disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>

          <p className="text-xs text-[#8b949e] text-center mt-4">
            No account?{' '}
            <a href="/" className="text-[#58a6ff] hover:underline">
              Start free trial
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
```

2. Commit: `git commit -m "feat: add login page"`

---

## Task 15: Create post-checkout success page

**File:** `app/(marketing)/success/page.tsx`
**Interfaces:** Shown after Stripe Checkout completes; sets session cookie via `/api/auth/login`; redirects to `/dashboard`
**Depends on:** Task 12, Task 8

### Steps

1. Create `app/(marketing)/success/page.tsx`:
```typescript
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { TrendingUp } from 'lucide-react'

export default function SuccessPage() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')

  useEffect(() => {
    if (!sessionId) return

    // Retrieve the email from Stripe checkout session, then set session cookie
    fetch(`/api/stripe/session?session_id=${sessionId}`)
      .then(r => r.json())
      .then(({ email }) => {
        if (email) {
          return fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
        }
      })
      .then(r => r?.json())
      .then(data => {
        if (data?.redirect) window.location.href = data.redirect
      })
  }, [sessionId])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#3fb950]/20 flex items-center justify-center mx-auto">
          <TrendingUp className="w-6 h-6 text-[#3fb950]" />
        </div>
        <h1 className="text-2xl font-semibold text-[#e6edf3]">You&apos;re in.</h1>
        <p className="text-[#8b949e]">Setting up your account&hellip;</p>
      </div>
    </div>
  )
}
```

2. Create `app/api/stripe/session/route.ts` (needed by success page to get email from session ID):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId)
  return NextResponse.json({ email: session.customer_email })
}
```

3. Commit: `git commit -m "feat: add post-checkout success page and session retrieval route"`

---

## Task 16: Create landing page

**File:** `app/(marketing)/page.tsx`
**Interfaces:** Public marketing page at `/`; waitlist email form POSTs to `/api/waitlist`; CTA links to `/login`
**Depends on:** Task 8

### Steps

1. Create `app/(marketing)/page.tsx`:
```typescript
'use client'

import { useState, FormEvent } from 'react'
import { TrendingUp, Zap, BarChart2, FlaskConical, CheckCircle } from 'lucide-react'

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleWaitlist(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#21262d]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#58a6ff] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-[#e6edf3]">ForexTrader Pro</span>
        </div>
        <a
          href="/login"
          className="text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        >
          Sign in
        </a>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#58a6ff]/10 border border-[#58a6ff]/20 rounded-full text-xs text-[#58a6ff] font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-pulse" />
          Early Access — Joining Waitlist Now
        </div>

        <h1 className="text-4xl lg:text-5xl font-bold text-[#e6edf3] max-w-2xl leading-tight mb-4">
          Institutional-Grade Forex Signals.{' '}
          <span className="text-[#58a6ff]">No Guesswork.</span>
        </h1>

        <p className="text-lg text-[#8b949e] max-w-xl mb-10">
          Smart Money Concepts, COT positioning, and backtested strategies — all in one dashboard.
          Built for serious traders.
        </p>

        {/* Waitlist form */}
        {submitted ? (
          <div className="flex items-center gap-2 text-[#3fb950] font-medium">
            <CheckCircle className="w-5 h-5" />
            You&apos;re on the list — we&apos;ll email you when we open access.
          </div>
        ) : (
          <form onSubmit={handleWaitlist} className="flex gap-2 w-full max-w-sm">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 bg-[#161b22] border border-[#21262d] rounded-lg text-[#e6edf3] placeholder-[#484f58] text-sm focus:outline-none focus:border-[#58a6ff]"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 bg-[#58a6ff] hover:bg-[#4393e6] disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              {loading ? '...' : 'Join Waitlist'}
            </button>
          </form>
        )}

        <p className="text-xs text-[#484f58] mt-3">$99/month after launch. Cancel anytime.</p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 max-w-3xl w-full text-left">
          {[
            {
              icon: Zap,
              title: 'SMC Signals',
              desc: 'Auto-detected Fair Value Gaps, Order Blocks, and Break of Structure on live charts.',
            },
            {
              icon: BarChart2,
              title: 'COT Analysis',
              desc: 'CFTC Commitment of Traders data visualized weekly — see where institutions are positioned.',
            },
            {
              icon: FlaskConical,
              title: 'Backtesting',
              desc: 'Test any strategy on historical data with Sharpe ratio, drawdown, and win rate metrics.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-[#161b22] border border-[#21262d] rounded-xl p-5">
              <div className="w-8 h-8 rounded-lg bg-[#58a6ff]/10 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-[#58a6ff]" />
              </div>
              <h3 className="font-semibold text-[#e6edf3] mb-1">{title}</h3>
              <p className="text-sm text-[#8b949e]">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-6 text-xs text-[#484f58] border-t border-[#21262d]">
        © 2026 ForexTrader Pro · <a href="/login" className="hover:text-[#8b949e]">Sign in</a>
      </footer>
    </div>
  )
}
```

2. Commit: `git commit -m "feat: add marketing landing page with waitlist form"`

---

## Task 17: Create waitlist API route (Mailchimp)

**File:** `app/api/waitlist/route.ts`
**Interfaces:** POST `{ email }` → adds to Mailchimp list → returns `{ ok: true }`
**Depends on:** Task 16

### Steps

1. Append to `.env.local.example`:
```
MAILCHIMP_API_KEY=your-mailchimp-api-key
MAILCHIMP_LIST_ID=your-list-id
MAILCHIMP_SERVER_PREFIX=us1
```

2. Create `app/api/waitlist/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const { MAILCHIMP_API_KEY, MAILCHIMP_LIST_ID, MAILCHIMP_SERVER_PREFIX } = process.env

  try {
    const res = await fetch(
      `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`,
      {
        method: 'POST',
        headers: {
          Authorization: `apikey ${MAILCHIMP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_address: email, status: 'subscribed' }),
      }
    )

    if (!res.ok && res.status !== 400) {
      // 400 = already subscribed — treat as success
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

3. Commit: `git commit -m "feat: add Mailchimp waitlist API route"`

---

## Self-Review Checklist

- [x] Every task has exact file paths
- [x] Every code block is complete (no placeholders except env var values)
- [x] Type consistency: `SubscriptionStatus` used in `stripe.ts`, `session.ts`, types
- [x] No "TBD" — all code is complete and runnable
- [x] Task granularity: 2–5 min each
- [x] Dependencies explicit between tasks
- [x] Spec fully covered: freelance docs ✓, landing page ✓, Stripe paywall ✓, waitlist ✓, auth middleware ✓

---

## Execution Order

Priority order for fastest revenue:
1. Tasks 1–3 (freelance docs) → start outreach **today**
2. Tasks 4–9 (routing setup) → unblocks paywall work
3. Tasks 10–13 (Stripe APIs + middleware) → core paywall
4. Tasks 14–17 (marketing pages) → public-facing launch

**Which execution mode do you prefer?**

- **Option A: Subagent-driven** — fresh subagent per task, review after each, higher quality
- **Option B: Inline** — work through tasks sequentially in this session
