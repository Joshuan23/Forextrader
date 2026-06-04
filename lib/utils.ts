import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number, digits: number): string {
  return price.toFixed(digits)
}

export function formatPips(pips: number): string {
  const sign = pips >= 0 ? '+' : ''
  return `${sign}${pips.toFixed(1)}`
}

export function formatCurrency(amount: number): string {
  const sign = amount >= 0 ? '' : '-'
  const abs = Math.abs(amount)
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}
