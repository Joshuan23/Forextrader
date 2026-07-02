import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  const session = await getStripe().checkout.sessions.retrieve(sessionId)

  if (session.status !== 'complete') {
    return NextResponse.json({ error: 'Checkout not completed' }, { status: 402 })
  }

  if (!session.customer_email) {
    return NextResponse.json({ error: 'No email on session' }, { status: 422 })
  }

  return NextResponse.json({ email: session.customer_email })
}
