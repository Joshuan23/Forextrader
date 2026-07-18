import * as Notifications from 'expo-notifications'
import { getSupabase } from '@/lib/supabase'
import type { Plan } from '@/entitlements/types'

// Push registration. The token is stored in notification_preferences; the
// backend (or a Supabase edge function) sends via Expo's push API for:
//   new approved signal (pro+), trial ending, subscription expiring,
//   upgrade promotions (free), optional daily recap.
// Tier rules are enforced server-side at send time from the entitlements table.

export async function registerForPush(plan: Plan): Promise<string | null> {
  const settings = await Notifications.getPermissionsAsync()
  let status = settings.status
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status
  }
  if (status !== 'granted') return null

  const token = (await Notifications.getExpoPushTokenAsync()).data

  const supabase = getSupabase()
  if (supabase) {
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      await supabase.from('notification_preferences').upsert(
        {
          user_id: data.user.id,
          expo_push_token: token,
          signal_alerts: plan !== 'free',
          trial_reminders: true,
          promotions: plan === 'free',
        },
        { onConflict: 'user_id' }
      )
    }
  }
  return token
}
