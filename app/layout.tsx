import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppShell } from '@/components/layout/app-shell'

export const metadata: Metadata = {
  title: {
    default: 'FlowEdge — FX Decision Engine',
    template: '%s · FlowEdge',
  },
  description:
    'Institutional-style forex trade plans: exact levels, contextual validation, and expectancy feedback.',
}

export const viewport: Viewport = {
  themeColor: '#070b12',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
