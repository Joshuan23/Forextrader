import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionStatus, createCheckoutSession } from '@/lib/stripe'
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
    const url = await createCheckoutSession(email)
    if (!url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }
    return NextResponse.json({ redirect: url })
  }

  return NextResponse.json({
    error: 'Your subscription is inactive. Please reactivate via the customer portal.',
    portalRedirect: `${process.env.NEXT_PUBLIC_APP_URL}/portal`,
  }, { status: 403 })
}
