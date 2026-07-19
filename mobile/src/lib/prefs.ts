import AsyncStorage from '@react-native-async-storage/async-storage'

// Local user preferences + onboarding state.

export interface UserPrefs {
  onboarded: boolean
  tradingFocus: 'scalp' | 'intraday' | 'swing'
  pairs: string[]
  sessions: string[]
  notificationsEnabled: boolean
}

export const DEFAULT_PREFS: UserPrefs = {
  onboarded: false,
  tradingFocus: 'intraday',
  pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
  sessions: ['london', 'newyork', 'london_ny_overlap'],
  notificationsEnabled: false,
}

const KEY = 'flowedge.prefs'

export async function loadPrefs(): Promise<UserPrefs> {
  const raw = await AsyncStorage.getItem(KEY)
  if (!raw) return DEFAULT_PREFS
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<UserPrefs>) }
  } catch {
    return DEFAULT_PREFS
  }
}

export async function savePrefs(next: Partial<UserPrefs>): Promise<UserPrefs> {
  const current = await loadPrefs()
  const merged = { ...current, ...next }
  await AsyncStorage.setItem(KEY, JSON.stringify(merged))
  return merged
}
