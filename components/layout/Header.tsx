'use client'

import { useEffect, useState } from 'react'
import { Account } from '@/types/forex'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const [account, setAccount] = useState<Account | null>(null)

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const res = await fetch('/api/account')
        if (res.ok) {
          const data: Account = await res.json()
          setAccount(data)
        }
      } catch {
        // ignore
      }
    }

    fetchAccount()
    const interval = setInterval(fetchAccount, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="h-16 bg-[#161b22] border-b border-[#21262d] flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h1 className="text-lg font-semibold text-[#e6edf3]">{title}</h1>
        {subtitle && <p className="text-xs text-[#8b949e]">{subtitle}</p>}
      </div>

      {account && (
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-[#8b949e] uppercase tracking-wide">Balance</p>
            <p className="text-sm font-semibold text-[#e6edf3]">{formatCurrency(account.balance)}</p>
          </div>
          <div className="w-px h-8 bg-[#21262d]" />
          <div className="text-right">
            <p className="text-xs text-[#8b949e] uppercase tracking-wide">Equity</p>
            <p className="text-sm font-semibold text-[#e6edf3]">{formatCurrency(account.equity)}</p>
          </div>
          <div className="w-px h-8 bg-[#21262d]" />
          <div className="text-right">
            <p className="text-xs text-[#8b949e] uppercase tracking-wide">Open P&L</p>
            <p
              className={cn(
                'text-sm font-semibold',
                account.openPnl >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'
              )}
            >
              {account.openPnl >= 0 ? '+' : ''}{formatCurrency(account.openPnl)}
            </p>
          </div>
          <div className="w-px h-8 bg-[#21262d]" />
          <div className="text-right">
            <p className="text-xs text-[#8b949e] uppercase tracking-wide">Margin Level</p>
            <p className="text-sm font-semibold text-[#d29922]">{account.marginLevel}%</p>
          </div>
        </div>
      )}

      {!account && (
        <div className="flex items-center gap-2">
          <div className="w-24 h-4 bg-[#21262d] rounded animate-pulse" />
          <div className="w-24 h-4 bg-[#21262d] rounded animate-pulse" />
        </div>
      )}
    </header>
  )
}
