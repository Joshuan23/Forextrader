import { z } from 'zod'

// EXPO_PUBLIC_ vars are compiled into the bundle. Empty values switch the
// app into mock mode (mock billing, bundled signals, local journal) so the
// whole product runs in Expo Go with zero configuration.
const schema = z.object({
  supabaseUrl: z.string().url().optional(),
  supabaseAnonKey: z.string().min(20).optional(),
  apiUrl: z.string().url().optional(),
  revenueCatIosKey: z.string().min(10).optional(),
  revenueCatAndroidKey: z.string().min(10).optional(),
})

const opt = (v: string | undefined) => (v && v.length > 0 ? v : undefined)

export const env = schema.parse({
  supabaseUrl: opt(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: opt(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  apiUrl: opt(process.env.EXPO_PUBLIC_FLOWEDGE_API_URL),
  revenueCatIosKey: opt(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY),
  revenueCatAndroidKey: opt(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY),
})

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
export const isRevenueCatConfigured = Boolean(env.revenueCatIosKey || env.revenueCatAndroidKey)
