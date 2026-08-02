import { useEffect, useMemo, useState } from 'react'
import { locationsApi, sacksApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { formatDateTime, statusLabel } from '@/lib/utils'
import type { Location, Sack } from '@/types'

const statusFilters = [
  {
    value: 'Sorting',
    label: 'Đang phân loại',
    description: 'Bao hàng đang ở khu vực nhập/chia chọn và chưa lên chuyến.',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  {
    value: 'InTransit',
    label: 'Đang vận chuyển',
    description: 'Bao hàng đã được đưa lên chuyến và đang vận chuyển.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  {
    value: 'ReadyForOutbound',
    label: 'Sẵn sàng xuất kho',
    description: 'Bao hàng đã chốt và sẵn sàng cho lệnh xuất kho.',
    tone: 'border-slate-200 bg-slate-50 text-slate-700',
  },
] as const

export default function SacksPage() {
  const [sacks, setSacks] = useState<Sack[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<(typeof statusFilters)[number]['value']>('Sorting')

  useEffect(() => {
    Promise.all([sacksApi.all(), locationsApi.all()])
      .then(([s, l]) => {
        setSacks(s)
        setLocations(l)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const destName = (id: string) => locations.find((l) => l.locationId === id)?.locationName ?? id
  const countFor = (status: string) => sacks.filter((sack) => sack.status === status).length

  const visibleSacks = useMemo(
    () =>
      sacks
        .filter((sack) => sack.status === activeStatus)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [sacks, activeStatus],
  )

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  const activeFilter = statusFilters.find((filter) => filter.value === activeStatus)!

  return (
    <div>
      <PageHeader
        title="Quản lý bao hàng"
        description="Theo dõi bao hàng theo pallet, khu vực, chuyến xe và điểm đến."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {statusFilters.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            variant="outline"
            onClick={() => setActiveStatus(filter.value)}
            className={`h-auto min-h-20 justify-between rounded-2xl px-7 py-5 text-left shadow-sm transition ${
              activeStatus === filter.value ? `ring-2 ring-primary ${filter.tone}` : 'bg-white hover:bg-slate-50'
            }`}
          >
            <span className="text-base font-semibold">{filter.label}</span>
            <span className="rounded-full border bg-white px-3 py-1 text-sm font-medium">{countFor(filter.value)}</span>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {activeFilter.label} ({visibleSacks.length})
          </CardTitle>
          <p className="text-sm text-slate-500">{activeFilter.description}</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã bao</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Pallet chứa</TableHead>
                <TableHead>Khu vực</TableHead>
                <TableHead>Chuyến xe</TableHead>
                <TableHead>Điểm đến</TableHead>
                <TableHead>Thời điểm tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSacks.map((sack) => (
                <TableRow key={sack.sackId}>
                  <TableCell className="font-mono text-xs font-medium">{sack.sackId}</TableCell>
                  <TableCell>
                    <Badge status={sack.status}>{statusLabel(sack.status)}</Badge>
                  </TableCell>
                  <TableCell>{sack.palletId ?? '—'}</TableCell>
                  <TableCell>{sack.zoneId ?? '—'}</TableCell>
                  <TableCell>{sack.tripId ?? '—'}</TableCell>
                  <TableCell>{destName(sack.sDestination)}</TableCell>
                  <TableCell>{formatDateTime(sack.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {visibleSacks.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">Không có bao hàng trong nhóm này.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
