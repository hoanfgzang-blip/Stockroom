import { useEffect, useState } from 'react'
import { locationsApi, sacksApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { formatDateTime, statusLabel } from '@/lib/utils'
import type { Location, Sack } from '@/types'

export default function SacksPage() {
  const [sacks, setSacks] = useState<Sack[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Quản lý bao hàng"
        description="Theo dõi bao hàng theo pallet, khu vực, chuyến xe và điểm đến."
      />

      <Card>
        <CardHeader>
          <CardTitle>Bao hàng ({sacks.length})</CardTitle>
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
              {sacks.map((sack) => (
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
        </CardContent>
      </Card>
    </div>
  )
}
