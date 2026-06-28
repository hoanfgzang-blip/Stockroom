import { cn } from '@/lib/utils'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-blue-700',
  outline: 'border border-slate-300 bg-white hover:bg-slate-50',
  ghost: 'hover:bg-slate-100',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
}

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-sm',
}

export function Button({
  className,
  variant = 'default',
  size = 'md',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
