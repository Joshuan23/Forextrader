import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionStatus, createCheckoutSession } from '@/lib/stripe'
import { createSessionCookie } from '@/lib/session'

export async function POST(req: NextRequest) {
  // Preview switch: when PREVIEW_MODE=true, skip Stripe entirely and let anyone
  // straight into the app. Lets you demo the product without any Stripe setup.
  // Off unless explicitly enabled — never set this in production.
  if (process.env.PREVIEW_MODE === 'true') {
    return NextResponse.json({ redirect: '/dashboard' })
  }

  // Fail fast with a clear message if Stripe isn't configured, instead of
  // letting the Stripe SDK throw a raw exception that surfaces as a vague
  // "Network error" on the client.
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Payments are not configured yet. Set STRIPE_SECRET_KEY.' },
      { status: 503 }
    )
  }

  let email: unknown
  try {
    ;({ email } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  try {
    const { status, customerId } = await getSubscriptionStatus(email)

    if ((status === 'active' || status === 'trialing') && customerId) {
      const cookie = createSessionCookie({ customerId, email, status })
      return NextResponse.json(
        { redirect: '/dashboard' },
        { headers: { 'Set-Cookie': cookie } }
      )
    }

    if (status === 'none') {
      const url = await createCheckoutSession(email, customerId)
      if (!url) {
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
      }
      return NextResponse.json({ redirect: url })
    }

    if (status === 'past_due') {
      return NextResponse.json({
        error: 'Your payment is past due. Please update your payment method.',
        portalRedirect: `${process.env.NEXT_PUBLIC_APP_URL}/portal`,
      }, { status: 402 })
    }

    return NextResponse.json({
      error: 'Your subscription is inactive. Please reactivate via the customer portal.',
      portalRedirect: `${process.env.NEXT_PUBLIC_APP_URL}/portal`,
    }, { status: 403 })
  } catch (err) {
    // Surface the real Stripe failure (bad key, wrong mode, price mismatch)
    // as a readable message rather than crashing into a 500 / "Network error".
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[auth/login] Stripe request failed:', message)
    return NextResponse.json(
      { error: `Could not verify your subscription: ${message}` },
      { status: 502 }
    )
  }
}
