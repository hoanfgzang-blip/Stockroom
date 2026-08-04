import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeSvgWriter } from '@zxing/browser'
import { Eye } from 'lucide-react'
import { locationsApi, sacksApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { formatDateTime, statusLabel } from '@/lib/utils'
import type { Location, Sack } from '@/types'

const statusFilters = [
  {
    value: 'Sorting',
    label: 'Đang phân loại',
    description: 'Bao hàng đang ở zone nhập/chia chọn và chưa lên chuyến.',
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

function SackQrCode({ value }: { value: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const svg = new BrowserQRCodeSvgWriter().write(value, 240, 240)
    svg.classList.add('h-full', 'w-full')
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', `Mã QR chứa ${value}`)
    container.replaceChildren(svg)

    return () => container.replaceChildren()
  }, [value])

  return <div ref={containerRef} className="aspect-square w-56 max-w-full rounded-lg border border-slate-200 bg-white p-2" />
}

export default function SacksPage() {
  const [sacks, setSacks] = useState<Sack[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<(typeof statusFilters)[number]['value']>('Sorting')
  const [selectedSack, setSelectedSack] = useState<Sack | null>(null)

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
        description="Theo dõi bao hàng theo pallet, zone, chuyến xe và điểm đến."
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
                <TableHead>Zone</TableHead>
                <TableHead>Điểm đến</TableHead>
                <TableHead>Thời điểm tạo</TableHead>
                <TableHead className="whitespace-nowrap">Thao tác</TableHead>
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
                  <TableCell>{destName(sack.sDestination)}</TableCell>
                  <TableCell>{formatDateTime(sack.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSack(sack)}
                      title={`Xem thông tin và QR của ${sack.sackId}`}
                    >
                      <Eye className="h-4 w-4" />
                      Xem
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {visibleSacks.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">Không có bao hàng trong nhóm này.</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedSack !== null}
        onClose={() => setSelectedSack(null)}
        title={selectedSack ? `Thông tin sack ${selectedSack.sackId}` : 'Thông tin sack'}
        description="Mã QR bên dưới chứa ID của sack để quét và tra cứu."
        className="max-w-2xl"
      >
        {selectedSack && (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
            <dl className="grid content-start gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Mã bao</dt>
                <dd className="mt-1 break-all font-mono text-sm font-semibold text-primary">{selectedSack.sackId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Trạng thái</dt>
                <dd className="mt-1"><Badge status={selectedSack.status}>{statusLabel(selectedSack.status)}</Badge></dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Điểm đến</dt>
                <dd className="mt-1 text-sm font-medium">{destName(selectedSack.sDestination)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Pallet chứa</dt>
                <dd className="mt-1 break-all font-mono text-sm">{selectedSack.palletId ?? 'Chưa gán'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Zone</dt>
                <dd className="mt-1 break-all font-mono text-sm">{selectedSack.zoneId ?? 'Chưa gán'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Chuyến xe</dt>
                <dd className="mt-1 break-all font-mono text-sm">{selectedSack.tripId ?? 'Chưa gán'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Thời điểm tạo</dt>
                <dd className="mt-1 text-sm">{formatDateTime(selectedSack.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Thời điểm kết thúc</dt>
                <dd className="mt-1 text-sm">{formatDateTime(selectedSack.endAt)}</dd>
              </div>
            </dl>

            <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm font-semibold text-slate-800">QR ID sack</p>
              <div className="mt-3">
                <SackQrCode value={selectedSack.sackId} />
              </div>
              <p className="mt-3 break-all font-mono text-xs text-slate-600">{selectedSack.sackId}</p>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
