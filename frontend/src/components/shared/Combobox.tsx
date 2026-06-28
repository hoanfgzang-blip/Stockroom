import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

export type ComboboxOption = {
  value: string
  label: string
  description?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  emptyText = 'No results found.',
  className,
}: {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q),
    )
  }, [options, query])

  const selected = options.find((o) => o.value === value)

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm"
      >
        <span className={cn(!selected && 'text-slate-400')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-8 border-0 px-0 shadow-none focus:ring-0"
            />
          </div>
          <div className="max-h-56 overflow-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">{emptyText}</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
                >
                  <Check
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    {option.description && (
                      <span className="block text-xs text-slate-500">{option.description}</span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
