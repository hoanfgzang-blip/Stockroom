import { cn } from '@/lib/utils'

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string
  onValueChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className} data-value={value} data-on-change={onValueChange.name}>
      {children}
    </div>
  )
}

export function TabsList({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
        active ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  active,
  children,
  className,
}: {
  active: boolean
  children: React.ReactNode
  className?: string
}) {
  if (!active) return null
  return <div className={cn('mt-4', className)}>{children}</div>
}
