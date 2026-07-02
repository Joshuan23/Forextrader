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
