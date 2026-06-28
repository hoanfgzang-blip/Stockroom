import { cn } from '@/lib/utils'

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-primary focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-primary focus:ring-2',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('text-sm font-medium text-slate-700', className)} {...props}>
      {children}
    </label>
  )
}
