'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Zap,
  CandlestickChart,
  NotebookPen,
  BarChart3,
  Settings,
} from 'lucide-react'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth/auth-provider'

// Signed-in user + sign out. Renders nothing when auth isn't configured.
function UserFooter() {
  const { user, configured, signOut } = useAuth()
  if (!configured || !user) return null
  return (
    <div className="border-t p-3">
      <div className="truncate text-xs font-medium text-foreground" title={user.email ?? ''}>
        {user.email}
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/signals', label: 'Signals', icon: Zap },
  { href: '/pairs', label: 'Pairs', icon: CandlestickChart },
  { href: '/journal', label: 'Journal', icon: NotebookPen },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function useActive(href: string) {
  const pathname = usePathname()
  return pathname === href || pathname.startsWith(href + '/')
}

function NavLink({ href, label, icon: Icon }: (typeof NAV_ITEMS)[number]) {
  const active = useActive(href)
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-secondary text-primary'
          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
      )}
    >
      <Icon className="h-4.5 w-4.5 h-[18px] w-[18px] shrink-0" />
      {label}
    </Link>
  )
}

// Desktop sidebar
export function Nav() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <Image src="/flowedge-logo.png" alt="FlowEdge" width={32} height={32} priority className="h-8 w-8 rounded-md" />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">FlowEdge</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            FX Decision Engine
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
      <UserFooter />
      <div className="border-t p-3 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        Discipline over frequency
      </div>
    </aside>
  )
}

// Mobile bottom tab bar
export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-6">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <MobileTab key={href} href={href} label={label} icon={Icon} />
        ))}
      </div>
    </nav>
  )
}

function MobileTab({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: (typeof NAV_ITEMS)[number]['icon']
}) {
  const active = useActive(href)
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center gap-1 py-2 text-[10px] font-medium',
        active ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  )
}
