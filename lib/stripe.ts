import Stripe from 'stripe'
import { SubscriptionStatus } from '@/types/subscription'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
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
  // Map all Stripe statuses to our union; unmapped ones (unpaid, incomplete, paused) → past_due or none
  const STATUS_MAP: Record<string, SubscriptionStatus> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    incomplete: 'none',
    incomplete_expired: 'none',
    paused: 'none',
  }
  // limit:1 returns the most-recently-created subscription (assumes one active sub per customer)
  const status: SubscriptionStatus = STATUS_MAP[sub.status] ?? 'none'
  return { status, customerId: customer.id }
}

export async function createCheckoutSession(email: string): Promise<string | null> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: { trial_period_days: 7 },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
  })
  return session.url
}
