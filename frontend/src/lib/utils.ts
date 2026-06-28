import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatTimeSpan(value?: string | null): string {
  if (!value) return '—'
  const parts = value.split(':')
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`
  return value
}

export function getStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const s = status.toLowerCase().replace(/[\s_-]/g, '')
  if (['completed', 'active', 'available', 'intransit', 'inprogress', 'fulfilled', 'arrived'].includes(s))
    return 'success'
  if (['pending', 'processing', 'reserved', 'sorting', 'scheduled'].includes(s)) return 'warning'
  if (['cancelled', 'expired', 'inactive', 'full', 'locked'].includes(s)) return 'danger'
  return 'neutral'
}

export function tripColumnLabel(status: string): string {
  const map: Record<string, string> = {
    Pending: 'Scheduled',
    InProgress: 'In Transit',
    Completed: 'Arrived',
    Cancelled: 'Cancelled',
  }
  return map[status] ?? status
}

export const TRIP_COLUMNS = ['Pending', 'InProgress', 'Completed', 'Cancelled'] as const
