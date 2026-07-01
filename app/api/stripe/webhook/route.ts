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

  switch (event.type) {
    case 'checkout.session.completed':
      break
    case 'customer.subscription.deleted':
      break
    default:
      break
  }

  return NextResponse.json({ received: true })
}

export const config = { api: { bodyParser: false } }
