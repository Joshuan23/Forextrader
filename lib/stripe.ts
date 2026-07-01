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
  const status = sub.status as SubscriptionStatus
  return { status, customerId: customer.id }
}
