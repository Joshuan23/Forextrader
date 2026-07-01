'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  LineChart,
  FlaskConical,
  Cpu,
  List,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, highlight: false },
  { href: '/signals', label: 'SMC Signals', icon: Zap, highlight: true },
  { href: '/charts', label: 'Charts', icon: LineChart, highlight: false },
  { href: '/backtesting', label: 'Backtesting', icon: FlaskConical, highlight: false },
  { href: '/strategies', label: 'Strategies', icon: Cpu, highlight: false },
  { href: '/positions', label: 'Positions', icon: List, highlight: false },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-16 lg:w-56 bg-[#161b22] border-r border-[#21262d] flex flex-col z-50">
      {/* Logo */}
      <div className="h-16 flex items-center px-3 lg:px-4 border-b border-[#21262d] gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#58a6ff] flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div className="hidden lg:block">
          <span className="text-sm font-semibold text-[#e6edf3]">ForexTrader</span>
          <span className="text-xs text-[#58a6ff] font-medium block -mt-0.5">Pro</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ href, label, icon: Icon, highlight }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-[#21262d] text-[#58a6ff]'
                  : highlight
                  ? 'text-emerald-400 hover:text-emerald-300 hover:bg-[#21262d]'
                  : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden lg:block">{label}</span>
              {highlight && !active && (
                <span className="hidden lg:inline-flex ml-auto px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded font-semibold">
                  NEW
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom info */}
      <div className="p-3 border-t border-[#21262d]">
        <div className="hidden lg:block text-xs text-[#8b949e] text-center">
          v0.1.0 — SMC Edition
        </div>
      </div>
    </aside>
  )
}
