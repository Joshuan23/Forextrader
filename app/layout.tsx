import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ForexTrader Pro',
  description: 'Institutional-Grade Forex Signals',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0f1117] text-[#e6edf3] min-h-screen">
        {children}
      </body>
    </html>
  )
}
