import React, { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { loadPrefs } from '@/lib/prefs'
import { Loading, Screen } from '@/components/ui'

// Entry gate: first launch → onboarding; otherwise straight to the app.
export default function Index() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    void loadPrefs().then((p) => setOnboarded(p.onboarded))
  }, [])

  if (onboarded === null) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    )
  }
  return <Redirect href={onboarded ? '/(tabs)/home' : '/onboarding'} />
}
