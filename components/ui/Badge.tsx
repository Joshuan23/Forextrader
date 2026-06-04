import { cn } from '@/lib/utils'

type BadgeVariant = 'green' | 'red' | 'gray' | 'blue' | 'amber'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  green: 'bg-[#3fb950]/20 text-[#3fb950] border border-[#3fb950]/30',
  red: 'bg-[#f85149]/20 text-[#f85149] border border-[#f85149]/30',
  gray: 'bg-[#8b949e]/20 text-[#8b949e] border border-[#8b949e]/30',
  blue: 'bg-[#58a6ff]/20 text-[#58a6ff] border border-[#58a6ff]/30',
  amber: 'bg-[#d29922]/20 text-[#d29922] border border-[#d29922]/30',
}

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
