import { useEffect, useState } from 'react'
import { carsApi } from '@/api/services'
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
import type { Car } from '@/types'

export default function FleetPage() {
  const [cars, setCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    carsApi
      .all()
      .then(setCars)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader title="Fleet Management" description="Vehicle registry and capacity tracking." />
      <Card>
        <CardHeader>
          <CardTitle>Vehicles ({cars.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plate / ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacity (kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cars.map((car) => (
                <TableRow key={car.carId}>
                  <TableCell className="font-mono font-medium">{car.carId}</TableCell>
                  <TableCell>
                    <Badge status="Active">{car.carType}</Badge>
                  </TableCell>
                  <TableCell>{car.capacity.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
