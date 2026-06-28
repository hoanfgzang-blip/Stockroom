import { useEffect, useState } from 'react'
import { cn, formatDateTime } from '@/lib/utils'

export function CountdownTimer({
  expiresAt,
  className,
}: {
  expiresAt: string
  className?: string
}) {
  const [remaining, setRemaining] = useState(() => getRemaining(expiresAt))

  useEffect(() => {
    const timer = setInterval(() => setRemaining(getRemaining(expiresAt)), 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  const expired = remaining.total <= 0

  return (
    <div className={cn('space-y-1', className)}>
      <div
        className={cn(
          'font-mono text-sm font-semibold',
          expired ? 'text-red-600' : remaining.total < 3600000 ? 'text-amber-600' : 'text-emerald-600',
        )}
      >
        {expired ? 'EXPIRED' : formatCountdown(remaining)}
      </div>
      <div className="text-xs text-slate-500">Expires {formatDateTime(expiresAt)}</div>
    </div>
  )
}

function getRemaining(expiresAt: string) {
  const total = new Date(expiresAt).getTime() - Date.now()
  const abs = Math.max(0, total)
  const hours = Math.floor(abs / 3600000)
  const minutes = Math.floor((abs % 3600000) / 60000)
  const seconds = Math.floor((abs % 60000) / 1000)
  return { total, hours, minutes, seconds }
}

function formatCountdown(r: { hours: number; minutes: number; seconds: number }) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(r.hours)}:${pad(r.minutes)}:${pad(r.seconds)}`
}
