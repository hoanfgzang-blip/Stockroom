import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeSvgWriter } from '@zxing/browser'
import { ArrowRight, PackageCheck, PackagePlus, Plus, Printer } from 'lucide-react'
import { carsApi, employeesApi, locationsApi, sacksApi, tripsApi, type CreateTripRequest } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/input'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { TRIP_COLUMNS, formatDateTime, statusLabel, tripColumnLabel } from '@/lib/utils'
import type { Car, Employee, Location, Sack, Trip, TripQrManifest } from '@/types'

const emptyForm = (): CreateTripRequest => ({ employeeId: '', carId: '', origin: '', destination: '', type: 'Inbound', sackIds: [] })

function printTripManifest(manifest: TripQrManifest) {
  const printWindow = window.open('', '_blank', 'width=760,height=900')
  if (!printWindow) return

  const payload = JSON.stringify(manifest)
  const qrSvg = new BrowserQRCodeSvgWriter().write(payload, 320, 320).outerHTML
  const sackRows = manifest.sacks.map((sack, index) => `<tr><td>${index + 1}</td><td>${sack.sackId}</td><td>${sack.destination}</td><td>${sack.status}</td></tr>`).join('')
  printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>QR trip ${manifest.tripId}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}main{max-width:190mm;border:1px solid #ddd;padding:8mm}header{display:grid;grid-template-columns:1fr 86mm;gap:8mm;align-items:start}h1{font-size:18pt;margin:0 0 4mm}.code{font:700 12pt monospace;word-break:break-all}.meta{display:grid;grid-template-columns:28mm 1fr;gap:2mm 4mm;font-size:10pt}.label{color:#555}.qr{text-align:center}.qr svg{width:82mm;height:82mm}.hint{font-size:9pt;color:#555;margin-top:2mm}table{width:100%;border-collapse:collapse;margin-top:7mm;font-size:9pt}th,td{border:1px solid #ddd;padding:2mm;text-align:left}th{background:#f3f4f6}@page{size:auto;margin:10mm}</style></head><body><main><header><section><h1>WMS - QR chuyen xe</h1><p class="code">${manifest.tripId}</p><div class="meta"><span class="label">Loai</span><strong>${manifest.type}</strong><span class="label">Tai xe</span><strong>${manifest.driver.name} (${manifest.driver.id})</strong><span class="label">Xe</span><strong>${manifest.vehicle.id} - ${manifest.vehicle.type}</strong><span class="label">Tu</span><strong>${manifest.origin.name}</strong><span class="label">Den</span><strong>${manifest.destination.name}</strong><span class="label">So bao</span><strong>${manifest.sacks.length}</strong></div></section><section class="qr">${qrSvg}<p class="hint">Quet QR nay khi xe den diem dich de nhap/nhan hang va doi chieu bao den du.</p></section></header><table><thead><tr><th>#</th><th>Ma bao</th><th>Diem den</th><th>Trang thai khi xuat</th></tr></thead><tbody>${sackRows}</tbody></table></main><script>window.onload=()=>window.print();</script></body></html>`)
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

  // States for Load Sacks Scan Dialog
  const [loadScanOpen, setLoadScanOpen] = useState(false)
  const [activeLoadTrip, setActiveLoadTrip] = useState<Trip | null>(null)
  const [scanCodeInput, setScanCodeInput] = useState('')
  const [scanSubmitting, setScanSubmitting] = useState(false)
  const [scanModalError, setScanModalError] = useState<string | null>(null)
  const [scanModalNotice, setScanModalNotice] = useState<string | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const load = (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    Promise.all([tripsApi.all(), employeesApi.all(), carsApi.all(), locationsApi.all(), sacksApi.all()])
      .then(([tripData, employeeData, carData, locationData, sackData]) => {
        setTrips(tripData); setEmployees(employeeData); setCars(carData); setLocations(locationData); setSacks(sackData)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => { if (showSpinner) setLoading(false) })
  }

  useEffect(() => { load(true) }, [])

  const grouped = useMemo(() => {
    const sorted = [...trips].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const map: Record<string, Trip[]> = {}
    TRIP_COLUMNS.forEach((column) => { map[column] = sorted.filter((trip) => trip.status === column) })
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
      const newTrip: Trip = {
        ...created,
        status: created.status || (form.type === 'Outbound' ? 'Loading' : 'Pending'),
      }
      setCreateOpen(false)
      const message = form.type === 'Outbound' ? `Đã tạo ${created.tripId}. Chuyến đang chờ chất hàng.` : `Đã tạo ${created.tripId} với ${created.sackCount ?? form.sackIds.length} sack.`
      setNotice(message)
      setTrips((prev) => [newTrip, ...prev.filter((t) => t.tripId !== newTrip.tripId)])
      if (form.sackIds.length > 0) {
        setSacks((prev) => prev.map((s) => (form.sackIds.includes(s.sackId) ? { ...s, tripId: newTrip.tripId } : s)))
      }
      load(false)
    } catch (err) { setError((err as Error).message) } finally { setSaving(false) }
  }

  const showTripSacks = async (trip: Trip) => {
    setSelectedTrip(trip); setDetailsOpen(true); setTripSacks([])
    try { setTripSacks(await tripsApi.sacks(trip.tripId)) } catch (err) { setError((err as Error).message) }
  }

  const printTripQr = async (trip: Trip) => {
    try {
      setError(null)
      const manifest = await tripsApi.qrManifest(trip.tripId)
      printTripManifest(manifest)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Khong the tao QR cho chuyen xe.')
    }
  }

  const openLoadScan = (trip: Trip) => {
    setActiveLoadTrip(trip)
    setScanCodeInput('')
    setScanModalError(null)
    setScanModalNotice(null)
    setLoadScanOpen(true)
    setTimeout(() => scanInputRef.current?.focus(), 100)
  }

  const handleScanSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeLoadTrip || !scanCodeInput.trim() || scanSubmitting) return

    const code = scanCodeInput.trim()
    setScanSubmitting(true)
    setScanModalError(null)
    setScanModalNotice(null)

    try {
      if (!activeLoadTrip.sealCode) {
        // Step 1: Scan Seal code to start loading
        await tripsApi.scanSeal(activeLoadTrip.tripId, code)
        setScanModalNotice(`Đã đăng ký mã Seal ${code}. Bắt đầu chất hàng.`)
        setActiveLoadTrip((prev) => prev ? { ...prev, sealCode: code } : null)
        load()
      } else {
        const isSameSeal = code.toUpperCase() === activeLoadTrip.sealCode.toUpperCase()
        if (isSameSeal) {
          // Scan Seal code second time -> Seal and lock trip
          const res = await tripsApi.scanSeal(activeLoadTrip.tripId, code)
          setNotice(`Đã chốt seal ${code} thành công. Chuyến ${res.tripId} đã sẵn sàng xuất phát.`)
          setLoadScanOpen(false)
          load()
        } else {
          // Scan Sack code -> Load sack into trip
          const res = await tripsApi.loadSack(activeLoadTrip.tripId, code)
          setScanModalNotice(`Đã chất bao ${code} thành công. Hiện có ${res.loadedCount} bao trên chuyến.`)
          setActiveLoadTrip((prev) => prev ? { ...prev, sackCount: res.loadedCount } : null)
          load()
        }
      }
      setScanCodeInput('')
    } catch (err) {
      setScanModalError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi quét mã.')
    } finally {
      setScanSubmitting(false)
      setTimeout(() => scanInputRef.current?.focus(), 50)
    }
  }

  if (loading) return <LoadingState />
  if (error && trips.length === 0) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader title="Điều phối chuyến xe" description="Tạo chuyến xe nhập/xuất và theo dõi bao hàng trên chuyến." action={<Button onClick={openCreate}><Plus className="h-4 w-4" />Tạo chuyến xe</Button>} />
      {(error || notice) && <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error ?? notice}</div>}
      <div className="grid gap-4 xl:grid-cols-5">
        {TRIP_COLUMNS.map((status) => <Card key={status} className="flex flex-col"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">{tripColumnLabel(status)}</CardTitle><Badge status={status}>{grouped[status]?.length ?? 0}</Badge></div><CardDescription>{tripColumnLabel(status)}</CardDescription></CardHeader><CardContent className="flex flex-1 flex-col gap-3">
          {(grouped[status] ?? []).map((trip) => <div key={trip.tripId} className="rounded-lg border bg-slate-50 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><p className="font-mono text-xs font-semibold text-primary">{trip.tripId}</p><Badge status={trip.type}>{trip.type === 'Inbound' ? 'Nhập hàng' : 'Xuất hàng'}</Badge></div><p className="mt-2 text-sm font-medium">{getDriver(trip.employeeId)}</p><p className="text-xs text-slate-500">{getCar(trip.carId)}</p><div className="mt-3 flex items-center gap-1 text-xs text-slate-600"><span className="truncate">{getLocation(trip.origin)}</span><ArrowRight className="h-3 w-3 shrink-0" /><span className="truncate">{getLocation(trip.destination)}</span></div><p className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-700"><PackageCheck className="h-4 w-4 text-primary" />{trip.sackCount ?? 0} bao hàng trong chuyến</p><div className="mt-3 grid gap-2">
            {trip.type === 'Outbound' && trip.status === 'Loading' && (
              <Button size="sm" onClick={() => openLoadScan(trip)}><PackagePlus className="h-4 w-4" />Quét chất hàng</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => void showTripSacks(trip)}>Xem danh sách sack</Button>
            {!(trip.type === 'Outbound' && (trip.status === 'Loading' || !trip.sealedAt)) && (
              <Button size="sm" onClick={() => void printTripQr(trip)}><Printer className="h-4 w-4" />In QR chuyến</Button>
            )}
          </div><p className="mt-2 text-[11px] text-slate-400">Tạo {formatDateTime(trip.createdAt)}</p></div>)}
          {(grouped[status] ?? []).length === 0 && <p className="py-8 text-center text-xs text-slate-400">Chưa có chuyến</p>}
        </CardContent></Card>)}
      </div>

      {/* Dialog tạo chuyến xe */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo chuyến xe" description={form.type === 'Outbound' ? 'Tạo chuyến ở trạng thái đang chất hàng. Bao sẽ được gán bằng quét mã.' : 'Hệ thống tự sinh mã chuyến và gán các bao đã chọn.'}><form className="space-y-4" onSubmit={createTrip}>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label>Loại chuyến</Label><Select value={form.type} onChange={(event) => { const nextType = event.target.value as CreateTripRequest['type']; setForm((prev) => ({ ...prev, type: nextType, sackIds: nextType === 'Outbound' ? [] : prev.sackIds })) }}><option value="Inbound">Nhập hàng</option><option value="Outbound">Xuất hàng</option></Select></div><div><Label>Tài xế</Label><Select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>{employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeName}</option>)}</Select></div></div>
        <div><Label>Phương tiện</Label><Select value={form.carId} onChange={(event) => setForm({ ...form, carId: event.target.value })}>{cars.map((car) => <option key={car.carId} value={car.carId}>{car.carId} · {car.carType}</option>)}</Select></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label>Điểm đi</Label><Select value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })}>{locations.map((location) => <option key={location.locationId} value={location.locationId}>{location.locationName}</option>)}</Select></div><div><Label>Điểm đến</Label><Select value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })}>{locations.map((location) => <option key={location.locationId} value={location.locationId}>{location.locationName}</option>)}</Select></div></div>
        {form.type === 'Inbound' && (
          <div><div className="mb-2 flex items-center justify-between"><Label>Bao đã gán</Label><span className="text-xs text-slate-500">{form.sackIds.length} đã chọn</span></div><div className="max-h-52 overflow-y-auto rounded-md border border-slate-200 p-2">{availableSacks.map((sack) => <label key={sack.sackId} className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-slate-50"><input type="checkbox" checked={form.sackIds.includes(sack.sackId)} onChange={() => toggleSack(sack.sackId)} /><span className="font-mono text-xs font-medium">{sack.sackId}</span><span className="ml-auto text-xs text-slate-500">{sack.sDestination}</span></label>)}{availableSacks.length === 0 && <p className="p-3 text-center text-sm text-slate-500">Không có bao hàng trống để gán.</p>}</div></div>
        )}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo chuyến xe'}</Button></div>
      </form></Dialog>

      {/* Dialog danh sách bao hàng trong chuyến */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} title={selectedTrip ? `Bao hàng trong ${selectedTrip.tripId}` : 'Bao hàng'} description={`${tripSacks.length} bao hàng được gán cho chuyến này.`}><div className="max-h-80 space-y-2 overflow-y-auto">{tripSacks.map((sack) => <div key={sack.sackId} className="flex items-center justify-between rounded-md border px-3 py-2"><div><p className="font-mono text-sm font-medium">{sack.sackId}</p><p className="text-xs text-slate-500">Điểm đến: {sack.sDestination}</p></div><Badge status={sack.status}>{statusLabel(sack.status)}</Badge></div>)}{tripSacks.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Chuyến này chưa có bao hàng.</p>}</div></Dialog>

      {/* Dialog quét chất hàng (Outbound Loading) */}
      <Dialog
        open={loadScanOpen}
        onClose={() => setLoadScanOpen(false)}
        title={activeLoadTrip ? `Quét chất hàng - ${activeLoadTrip.tripId}` : 'Quét chất hàng'}
        description={
          !activeLoadTrip?.sealCode
            ? 'Quét mã Seal đầu tiên để đăng ký seal và bắt đầu chất hàng.'
            : `Mã Seal đã mở: ${activeLoadTrip.sealCode}. Quét mã bao để chất hàng, hoặc quét lại đúng mã Seal này để chốt chuyến xe.`
        }
      >
        <form onSubmit={handleScanSubmit} className="space-y-4">
          {(scanModalError || scanModalNotice) && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${scanModalError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {scanModalError ?? scanModalNotice}
            </div>
          )}

          <div className="rounded-lg border bg-slate-50 p-3 text-xs space-y-1">
            <p><strong>Mã Seal chuyến:</strong> {activeLoadTrip?.sealCode ? <span className="font-mono text-primary font-semibold">{activeLoadTrip.sealCode}</span> : <span className="text-amber-600 font-medium">Chưa mở (Quét mã seal đầu tiên)</span>}</p>
            <p><strong>Số bao đã chất:</strong> <span className="font-semibold text-primary">{activeLoadTrip?.sackCount ?? 0} bao</span></p>
          </div>

          <div>
            <Label>Ô quét mã (Mã Seal hoặc Mã Bao hàng)</Label>
            <div className="mt-1 flex gap-2">
              <Input
                ref={scanInputRef}
                value={scanCodeInput}
                onChange={(e) => setScanCodeInput(e.target.value)}
                placeholder={!activeLoadTrip?.sealCode ? 'Quét mã Seal ban đầu...' : 'Quét mã bao hoặc quét lại mã Seal...'}
                disabled={scanSubmitting}
                autoFocus
              />
              <Button type="submit" disabled={scanSubmitting || !scanCodeInput.trim()}>
                {scanSubmitting ? 'Đang gửi...' : 'Xác nhận'}
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setLoadScanOpen(false)}>
              Đóng
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
