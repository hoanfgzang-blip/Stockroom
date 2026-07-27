import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BrowserQRCodeSvgWriter } from '@zxing/browser'
import { ArrowRight, PackageCheck, Plus, Printer } from 'lucide-react'
import { carsApi, employeesApi, locationsApi, sacksApi, tripsApi, type CreateTripRequest } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Label, Select } from '@/components/ui/input'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { TRIP_COLUMNS, formatDateTime, tripColumnLabel } from '@/lib/utils'
import type { Car, Employee, Location, Sack, Trip } from '@/types'

const emptyForm = (): CreateTripRequest => ({ employeeId: '', carId: '', origin: '', destination: '', type: 'Inbound', sackIds: [] })

function printTripCode(trip: Trip) {
  const printWindow = window.open('', '_blank', 'width=480,height=560')
  if (!printWindow) return

  const qrSvg = new BrowserQRCodeSvgWriter().write(trip.tripId, 240, 240).outerHTML
  printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Tem xe ${trip.tripId}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}main{width:82mm;border:1px solid #ddd;padding:8mm;text-align:center}h1{font-size:16pt;margin:0 0 4mm}.code{font:700 12pt monospace;word-break:break-all}.hint{font-size:9pt;color:#555}@page{size:auto;margin:10mm}</style></head><body><main><h1>WMS - Tem xe inbound</h1><p class="code">${trip.tripId}</p><div>${qrSvg}</div><p class="hint">Quét mã tại màn hình Xe inbound khi xe đến kho.</p></main><script>window.onload=()=>window.print();</script></body></html>`)
  printWindow.document.close()
}
export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cars, setCars] = useState<Car[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [sacks, setSacks] = useState<Sack[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [tripSacks, setTripSacks] = useState<Sack[]>([])
  const [form, setForm] = useState<CreateTripRequest>(emptyForm())

  const load = () => {
    setLoading(true)
    Promise.all([tripsApi.all(), employeesApi.all(), carsApi.all(), locationsApi.all(), sacksApi.all()])
      .then(([tripData, employeeData, carData, locationData, sackData]) => {
        setTrips(tripData); setEmployees(employeeData); setCars(carData); setLocations(locationData); setSacks(sackData)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const map: Record<string, Trip[]> = {}
    TRIP_COLUMNS.forEach((column) => { map[column] = trips.filter((trip) => trip.status === column) })
    return map
  }, [trips])
  const availableSacks = useMemo(() => sacks.filter((sack) => !sack.tripId), [sacks])
  const getDriver = (id: string) => employees.find((employee) => employee.employeeId === id)?.employeeName ?? id
  const getCar = (id: string) => { const car = cars.find((item) => item.carId === id); return car ? `${car.carId} · ${car.carType}` : id }
  const getLocation = (id: string) => locations.find((location) => location.locationId === id)?.locationName ?? id

  const openCreate = () => {
    setError(null); setNotice(null)
    setForm({ ...emptyForm(), employeeId: employees[0]?.employeeId ?? '', carId: cars[0]?.carId ?? '', origin: locations[0]?.locationId ?? '', destination: locations[1]?.locationId ?? locations[0]?.locationId ?? '' })
    setCreateOpen(true)
  }
  const toggleSack = (sackId: string) => setForm((current) => ({ ...current, sackIds: current.sackIds.includes(sackId) ? current.sackIds.filter((id) => id !== sackId) : [...current.sackIds, sackId] }))

  const createTrip = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.employeeId || !form.carId || !form.origin || !form.destination || form.origin === form.destination) { setError('Hay chon day du tai xe, xe va diem di/dem hop le.'); return }
    setSaving(true); setError(null)
    try {
      const created = await tripsApi.create(form)
      setCreateOpen(false); setNotice(`Da tao ${created.tripId} voi ${created.sackCount ?? form.sackIds.length} sack.`); load()
    } catch (err) { setError((err as Error).message) } finally { setSaving(false) }
  }

  const showTripSacks = async (trip: Trip) => {
    setSelectedTrip(trip); setDetailsOpen(true); setTripSacks([])
    try { setTripSacks(await tripsApi.sacks(trip.tripId)) } catch (err) { setError((err as Error).message) }
  }

  if (loading) return <LoadingState />
  if (error && trips.length === 0) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader title="Trip Coordinator" description="Create inbound and outbound vehicle trips, then track their sacks." action={<Button onClick={openCreate}><Plus className="h-4 w-4" />Create trip</Button>} />
      {(error || notice) && <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error ?? notice}</div>}
      <div className="grid gap-4 xl:grid-cols-4">
        {TRIP_COLUMNS.map((status) => <Card key={status} className="flex flex-col"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">{tripColumnLabel(status)}</CardTitle><Badge status={status}>{grouped[status]?.length ?? 0}</Badge></div><CardDescription>{status}</CardDescription></CardHeader><CardContent className="flex flex-1 flex-col gap-3">
          {(grouped[status] ?? []).map((trip) => <div key={trip.tripId} className="rounded-lg border bg-slate-50 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><p className="font-mono text-xs font-semibold text-primary">{trip.tripId}</p><Badge status={trip.type}>{trip.type === 'Inbound' ? 'Nhập hàng' : 'Xuất hàng'}</Badge></div><p className="mt-2 text-sm font-medium">{getDriver(trip.employeeId)}</p><p className="text-xs text-slate-500">{getCar(trip.carId)}</p><div className="mt-3 flex items-center gap-1 text-xs text-slate-600"><span className="truncate">{getLocation(trip.origin)}</span><ArrowRight className="h-3 w-3 shrink-0" /><span className="truncate">{getLocation(trip.destination)}</span></div><p className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-700"><PackageCheck className="h-4 w-4 text-primary" />{trip.sackCount ?? 0} sack trong chuyến</p><div className="mt-3 grid gap-2"><Button size="sm" variant="outline" onClick={() => void showTripSacks(trip)}>Xem danh sách sack</Button>{trip.type === 'Inbound' && <Button size="sm" onClick={() => printTripCode(trip)}><Printer className="h-4 w-4" />In mã xe</Button>}</div><p className="mt-2 text-[11px] text-slate-400">Tạo {formatDateTime(trip.createdAt)}</p></div>)}
          {(grouped[status] ?? []).length === 0 && <p className="py-8 text-center text-xs text-slate-400">Chưa có chuyến</p>}
        </CardContent></Card>)}
      </div>
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create vehicle trip" description="The system generates the trip code and assigns selected sacks."><form className="space-y-4" onSubmit={createTrip}>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label>Trip type</Label><Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as CreateTripRequest['type'] })}><option value="Inbound">Inbound</option><option value="Outbound">Outbound</option></Select></div><div><Label>Driver</Label><Select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>{employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeName}</option>)}</Select></div></div>
        <div><Label>Vehicle</Label><Select value={form.carId} onChange={(event) => setForm({ ...form, carId: event.target.value })}>{cars.map((car) => <option key={car.carId} value={car.carId}>{car.carId} · {car.carType}</option>)}</Select></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label>Origin</Label><Select value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })}>{locations.map((location) => <option key={location.locationId} value={location.locationId}>{location.locationName}</option>)}</Select></div><div><Label>Destination</Label><Select value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })}>{locations.map((location) => <option key={location.locationId} value={location.locationId}>{location.locationName}</option>)}</Select></div></div>
        <div><div className="mb-2 flex items-center justify-between"><Label>Sacks assigned</Label><span className="text-xs text-slate-500">{form.sackIds.length} selected</span></div><div className="max-h-52 overflow-y-auto rounded-md border border-slate-200 p-2">{availableSacks.map((sack) => <label key={sack.sackId} className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-slate-50"><input type="checkbox" checked={form.sackIds.includes(sack.sackId)} onChange={() => toggleSack(sack.sackId)} /><span className="font-mono text-xs font-medium">{sack.sackId}</span><span className="ml-auto text-xs text-slate-500">{sack.sDestination}</span></label>)}{availableSacks.length === 0 && <p className="p-3 text-center text-sm text-slate-500">Không có sack trống để gán.</p>}</div></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create trip'}</Button></div>
      </form></Dialog>
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} title={selectedTrip ? `Sacks in ${selectedTrip.tripId}` : 'Sacks'} description={`${tripSacks.length} sack assigned to this trip.`}><div className="max-h-80 space-y-2 overflow-y-auto">{tripSacks.map((sack) => <div key={sack.sackId} className="flex items-center justify-between rounded-md border px-3 py-2"><div><p className="font-mono text-sm font-medium">{sack.sackId}</p><p className="text-xs text-slate-500">Điểm đến: {sack.sDestination}</p></div><Badge status={sack.status}>{sack.status}</Badge></div>)}{tripSacks.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Chuyến này chưa có sack.</p>}</div></Dialog>
    </div>
  )
}