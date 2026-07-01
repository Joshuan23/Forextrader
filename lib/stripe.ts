import Stripe from 'stripe'
import { SubscriptionStatus } from '@/types/subscription'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
})

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

export async function getSubscriptionStatus(email: string): Promise<{
  status: SubscriptionStatus
  customerId: string | null
}> {
  const customers = await stripe.customers.list({ email, limit: 1 })

  if (customers.data.length === 0) {
    return { status: 'none', customerId: null }
  }

  const customer = customers.data[0]

  // Query active first to avoid returning a stale canceled sub when a newer active one exists
  let subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'active',
    limit: 1,
  })
  if (subscriptions.data.length === 0) {
    subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'trialing',
      limit: 1,
    })
  }
  if (subscriptions.data.length === 0) {
    subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 1,
    })
  }

  if (subscriptions.data.length === 0) {
    return { status: 'none', customerId: customer.id }
  }

  const sub = subscriptions.data[0]
  const status: SubscriptionStatus = STATUS_MAP[sub.status] ?? 'none'
  return { status, customerId: customer.id }
}

export async function createCheckoutSession(
  email: string,
  customerId?: string | null,
): Promise<string | null> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    ...(customerId ? { customer: customerId } : { customer_email: email }),
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: { trial_period_days: 7 },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
  })
  return session.url
}
