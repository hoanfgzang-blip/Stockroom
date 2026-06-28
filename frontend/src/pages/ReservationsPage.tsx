import { useEffect, useState } from 'react'
import { reservationsApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CountdownTimer } from '@/components/shared/CountdownTimer'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { cn, formatDateTime } from '@/lib/utils'
import type { InventoryReservation } from '@/types'

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<InventoryReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [releasing, setReleasing] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    reservationsApi
      .all()
      .then(setReservations)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const isExpired = (r: InventoryReservation) => new Date(r.expiresAt).getTime() <= Date.now()

  const handleRelease = async (id: string) => {
    setReleasing(id)
    try {
      await reservationsApi.release(id)
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setReleasing(null)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Inventory Reservations"
        description="Monitor pallet reservations with live expiration countdown."
      />

      <Card>
        <CardHeader>
          <CardTitle>Reservation Queue ({reservations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reservation</TableHead>
                <TableHead>Outbound Order</TableHead>
                <TableHead>Sack</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Countdown</TableHead>
                <TableHead>Reserved At</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((r) => {
                const expired = isExpired(r)
                return (
                  <TableRow
                    key={r.reservationId}
                    className={cn(expired && 'bg-red-50/80')}
                  >
                    <TableCell className="font-mono text-xs">{r.reservationId}</TableCell>
                    <TableCell>{r.outboundOrderId}</TableCell>
                    <TableCell>{r.sackId}</TableCell>
                    <TableCell>
                      <Badge status={expired ? 'Expired' : r.status}>
                        {expired ? 'Expired' : r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <CountdownTimer expiresAt={r.expiresAt} />
                    </TableCell>
                    <TableCell>{formatDateTime(r.reservedAt)}</TableCell>
                    <TableCell>
                      {(expired || r.status === 'Active') && (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={releasing === r.reservationId}
                          onClick={() => handleRelease(r.reservationId)}
                        >
                          {releasing === r.reservationId ? 'Releasing...' : 'Release Capacity'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
