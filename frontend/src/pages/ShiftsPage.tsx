import { useEffect, useState } from 'react'
import { shiftsApi } from '@/api/services'
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
import { formatTimeSpan } from '@/lib/utils'
import type { Shift } from '@/types'

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    shiftsApi
      .all()
      .then(setShifts)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader title="Quản lý ca làm việc" description="Lịch và thời gian làm việc theo ca." />
      <Card>
        <CardHeader>
          <CardTitle>Ca làm việc ({shifts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên ca</TableHead>
                <TableHead>Bắt đầu</TableHead>
                <TableHead>Kết thúc</TableHead>
                <TableHead>ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.shiftId}>
                  <TableCell className="font-medium">{shift.shiftName}</TableCell>
                  <TableCell>{formatTimeSpan(shift.startAt)}</TableCell>
                  <TableCell>{formatTimeSpan(shift.endAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{shift.shiftId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
