import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { env, isSupabaseConfigured } from './env'

// Session tokens live in the device keychain, not AsyncStorage.
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  if (!client) {
    client = createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  }
  return client
}
