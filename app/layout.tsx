import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'ForexTrader Pro',
  description: 'Professional Forex Trading Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0f1117] text-[#e6edf3] min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen ml-16 lg:ml-56">
          {children}
        </div>
      </body>
    </html>
  )
}
