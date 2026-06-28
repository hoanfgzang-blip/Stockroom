import { useState } from 'react'
import { cn } from '@/lib/utils'

function parseJson(value?: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="flex-1">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-emerald-300">
        {data === null ? '—' : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

export function JsonViewer({
  oldValues,
  newValues,
}: {
  oldValues?: string | null
  newValues?: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const oldData = parseJson(oldValues)
  const newData = parseJson(newValues)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'text-sm font-medium text-primary hover:underline',
        )}
      >
        {expanded ? 'Hide payload diff' : 'View payload diff'}
      </button>
      {expanded && (
        <div className="mt-3 flex flex-col gap-4 lg:flex-row">
          <JsonBlock title="Previous (old_values)" data={oldData} />
          <JsonBlock title="Updated (new_values)" data={newData} />
        </div>
      )}
    </div>
  )
}
