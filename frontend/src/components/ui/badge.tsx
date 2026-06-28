import { cn } from '@/lib/utils'
import { getStatusVariant } from '@/lib/utils'

const variants = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/20',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/20',
}

export function Badge({
  status,
  className,
  children,
}: {
  status?: string
  className?: string
  children?: React.ReactNode
}) {
  const label = children ?? status ?? 'Unknown'
  const variant = getStatusVariant(String(status ?? label))
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        variants[variant],
        className,
      )}
    >
      {label}
    </span>
  )
}
