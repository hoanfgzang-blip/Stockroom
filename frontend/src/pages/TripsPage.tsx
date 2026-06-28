import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { employeesApi, tripsApi, carsApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { TRIP_COLUMNS, formatDateTime, tripColumnLabel } from '@/lib/utils'
import type { Car, Employee, Trip } from '@/types'

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cars, setCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([tripsApi.all(), employeesApi.all(), carsApi.all()])
      .then(([t, e, c]) => {
        setTrips(t)
        setEmployees(e)
        setCars(c)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => {
    const map: Record<string, Trip[]> = {}
    TRIP_COLUMNS.forEach((col) => {
      map[col] = trips.filter((t) => t.status === col)
    })
    return map
  }, [trips])

  const getDriver = (id: string) => employees.find((e) => e.employeeId === id)?.employeeName ?? id
  const getCar = (id: string) => {
    const car = cars.find((c) => c.carId === id)
    return car ? `${car.carId} · ${car.carType}` : id
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Trip Coordinator"
        description="Kanban board for scheduling and tracking inter-provincial shipments."
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {TRIP_COLUMNS.map((status) => (
          <Card key={status} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{tripColumnLabel(status)}</CardTitle>
                <Badge status={status}>{grouped[status]?.length ?? 0}</Badge>
              </div>
              <CardDescription>{status}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              {(grouped[status] ?? []).map((trip) => (
                <div key={trip.tripId} className="rounded-xl border bg-slate-50 p-4 shadow-sm">
                  <p className="font-mono text-xs font-semibold text-primary">{trip.tripId}</p>
                  <p className="mt-2 text-sm font-medium">{getDriver(trip.employeeId)}</p>
                  <p className="text-xs text-slate-500">{getCar(trip.carId)}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs text-slate-600">
                    <span className="truncate">{trip.origin}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span className="truncate">{trip.destination}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Dispatch {formatDateTime(trip.createdAt)}
                  </p>
                  <Badge status={trip.type} className="mt-2">
                    {trip.type}
                  </Badge>
                </div>
              ))}
              {(grouped[status] ?? []).length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">No trips</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
