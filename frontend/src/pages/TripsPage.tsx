import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeSvgWriter } from '@zxing/browser'
import { AlertCircle, ArrowRight, Loader2, PackageCheck, PackagePlus, Plus, Printer } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { carsApi, employeesApi, locationsApi, outboundOrdersApi, sacksApi, tripsApi, type CreateTripRequest } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/input'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { TRIP_COLUMNS, formatDateTime, statusLabel, tripColumnLabel } from '@/lib/utils'
import type { Car, Employee, Location, OutboundOrder, Sack, Trip, TripQrTokenIssueResponse } from '@/types'

const emptyForm = (): CreateTripRequest => ({ employeeId: '', carId: '', origin: '', destination: '', type: 'Inbound', outboundOrderId: null, sackIds: [] })
const TRIP_QR_PREFIX = 'WMS-TRIP-QR:'

function escapeHtml(value: string | number) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function printTripQr(token: TripQrTokenIssueResponse) {
  const printWindow = window.open('', '_blank', 'width=760,height=900')
  if (!printWindow) return

  const qrSvg = new BrowserQRCodeSvgWriter().write(token.qrValue, 320, 320).outerHTML
  const tripId = escapeHtml(token.tripId)
  const driverName = escapeHtml(token.driverName)
  const carInfo = escapeHtml(token.carInfo)
  const originName = escapeHtml(token.originName)
  const destinationName = escapeHtml(token.destinationName)
  const sackCount = escapeHtml(token.sackCount)
  const expiresAt = escapeHtml(formatDateTime(token.expiresAt))
 printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>QR trip ${tripId}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}main{max-width:190mm;border:1px solid #ddd;padding:8mm}header{display:grid;grid-template-columns:1fr 86mm;gap:8mm;align-items:start}h1{font-size:18pt;margin:0 0 4mm}.code{font:700 12pt monospace;word-break:break-all}.meta{display:grid;grid-template-columns:28mm 1fr;gap:2mm 4mm;font-size:10pt}.label{color:#555}.qr{text-align:center}.qr svg{width:36mm;height:36mm}.hint{font-size:9pt;color:#555;margin-top:2mm}@page{size:auto;margin:10mm}</style></head><body><main><header><section><h1>WMS - QR chuyen xe</h1><p class="code">${tripId}</p><div class="meta"><span class="label">Tai xe</span><strong>${driverName}</strong><span class="label">Xe</span><strong>${carInfo}</strong><span class="label">Tu</span><strong>${originName}</strong><span class="label">Den</span><strong>${destinationName}</strong><span class="label">So bao</span><strong>${sackCount}</strong><span class="label">Het han</span><strong>${expiresAt}</strong></div></section><section class="qr">${qrSvg}<p class="hint">Quet QR nay de mo phien chat hang tai hub xuat phat va doi chieu hang tai diem den.</p></section></header></main><script>window.onload=()=>window.print();</script></body></html>`)
  printWindow.document.close()
}

export default function TripsPage() {
  const { user } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cars, setCars] = useState<Car[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [dispatchDestinations, setDispatchDestinations] = useState<Location[]>([])
  const [sacks, setSacks] = useState<Sack[]>([])
  const [outboundOrders, setOutboundOrders] = useState<OutboundOrder[]>([])
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
  const [resultTripId, setResultTripId] = useState<string | null>(null)
  const [resultQrToken, setResultQrToken] = useState<TripQrTokenIssueResponse | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const [qrConfirmTrip, setQrConfirmTrip] = useState<Trip | null>(null)
  const [activeLoadTrip, setActiveLoadTrip] = useState<Trip | null>(null)
  const [scanCodeInput, setScanCodeInput] = useState('')
  const [scanSubmitting, setScanSubmitting] = useState(false)
  const [scanModalError, setScanModalError] = useState<string | null>(null)
  const [scanModalNotice, setScanModalNotice] = useState<string | null>(null)
  const [activeVehicleQr, setActiveVehicleQr] = useState<string | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const load = (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    Promise.allSettled([tripsApi.allForDispatch(), employeesApi.all(), carsApi.all(), locationsApi.all(), locationsApi.dispatchDestinations(), sacksApi.all(), outboundOrdersApi.allForDispatch()])
      .then(([tripsRes, employeesRes, carsRes, locationsRes, destinationsRes, sacksRes, outboundOrdersRes]) => {
        if (tripsRes.status === 'fulfilled') setTrips(tripsRes.value)
        if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value)
        if (carsRes.status === 'fulfilled') setCars(carsRes.value)
        if (locationsRes.status === 'fulfilled') setLocations(locationsRes.value)
        if (destinationsRes.status === 'fulfilled') setDispatchDestinations(destinationsRes.value)
        if (sacksRes.status === 'fulfilled') setSacks(sacksRes.value)
        if (outboundOrdersRes.status === 'fulfilled') setOutboundOrders(outboundOrdersRes.value)

        const errors = [tripsRes, employeesRes, carsRes, locationsRes, destinationsRes, sacksRes, outboundOrdersRes]
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))

        if (errors.length > 0) {
          setError(`Đồng bộ dữ liệu thất bại: ${errors.join(', ')}`)
        }
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
  const getLocation = (id: string) => dispatchDestinations.find((location) => location.locationId === id)?.locationName ?? locations.find((location) => location.locationId === id)?.locationName ?? id
  const getMissingSackIds = (tripId: string) => sacks.filter((sack) => sack.tripId === tripId && sack.status === 'Missing').map((sack) => sack.sackId)
  const currentHubId = locations.some((location) => location.locationId === user?.locationId) ? user?.locationId ?? '' : ''
  const currentHubLocations = currentHubId ? locations.filter((location) => location.locationId === currentHubId) : locations
  const availableEmployees = currentHubId ? employees.filter((employee) => employee.locationId === currentHubId) : []
  const originOptions = form.type === 'Outbound' ? currentHubLocations : locations
  const selectableDestinations = form.type === 'Inbound' ? currentHubLocations : dispatchDestinations

  const openCreate = () => {
    setError(null); setNotice(null)
    setResultTripId(null)
    setResultQrToken(null)
    setQrError(null)
    setQrLoading(false)
    const destination = currentHubId || locations[0]?.locationId || ''
    const origin = locations.find((location) => location.locationId !== destination)?.locationId ?? destination
    setForm({ ...emptyForm(), employeeId: availableEmployees[0]?.employeeId ?? '', carId: cars[0]?.carId ?? '', origin, destination })
    setCreateOpen(true)
  }

  const issueQrToken = async (tripId: string): Promise<TripQrTokenIssueResponse | null> => {
    setResultTripId(tripId)
    setQrLoading(true)
    setQrError(null)
    setResultQrToken(null)
    try {
      const token = await tripsApi.issueQrToken(tripId)
      setResultQrToken(token)
      return token
    } catch (err) {
      setQrError(err instanceof Error ? err.message : 'Không thể cấp QR cho chuyến xe.')
      return null
    } finally {
      setQrLoading(false)
    }
  }

  const confirmQrIssue = () => {
    if (!qrConfirmTrip) return
    const tripId = qrConfirmTrip.tripId
    setQrConfirmTrip(null)
    void issueQrToken(tripId)
  }

  const handlePrintTripQr = (trip: Trip) => {
    setQrConfirmTrip(trip)
  }

  const closeResultDialog = () => {
    setResultTripId(null)
    setResultQrToken(null)
    setQrError(null)
    setQrLoading(false)
  }
  const toggleSack = (sackId: string) => setForm((current) => ({ ...current, sackIds: current.sackIds.includes(sackId) ? current.sackIds.filter((id) => id !== sackId) : [...current.sackIds, sackId] }))

  const selectOutboundOrder = (outboundOrderId: string) => {
    const order = outboundOrders.find((item) => item.outboundOrderId === outboundOrderId)
    setForm((current) => ({
      ...current,
      outboundOrderId: outboundOrderId || null,
      destination: order?.outboundDestination ?? current.destination,
    }))
  }

  const changeTripType = (nextType: CreateTripRequest['type']) => {
    setForm((previous) => {
      const nextOrigin = nextType === 'Outbound'
        ? currentHubId || previous.origin
        : previous.origin === currentHubId
          ? locations.find((location) => location.locationId !== currentHubId)?.locationId ?? previous.origin
          : previous.origin
      const nextDestinations = nextType === 'Inbound' ? currentHubLocations : dispatchDestinations
      const nextDestination = nextType === 'Inbound'
        ? currentHubId || (nextDestinations.find((location) => location.locationId !== nextOrigin)?.locationId ?? nextOrigin)
        : nextDestinations.some((location) => location.locationId === previous.destination && location.locationId !== nextOrigin)
          ? previous.destination
          : nextDestinations.find((location) => location.locationId !== nextOrigin)?.locationId ?? nextOrigin

      return {
        ...previous,
        type: nextType,
        origin: nextOrigin,
        destination: nextDestination,
        outboundOrderId: nextType === 'Outbound' ? previous.outboundOrderId : null,
        sackIds: nextType === 'Outbound' ? [] : previous.sackIds,
      }
    })
  }

  const createTrip = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.employeeId || !form.carId || !form.origin || !form.destination || form.origin === form.destination) { setError('Hay chon day du tai xe, xe va diem di/dem hop le.'); return }
    if (currentHubId && form.type === 'Outbound' && form.origin !== currentHubId) { setError('Chuyến outbound phải xuất phát từ hub của tài khoản.'); return }
    if (currentHubId && form.type === 'Inbound' && form.destination !== currentHubId) { setError('Chuyến inbound phải đến hub của tài khoản.'); return }
    if (form.type === 'Outbound' && !form.outboundOrderId) { setError('Hãy chọn đơn outbound cho chuyến xe.'); return }
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
      void issueQrToken(created.tripId)
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

  const openLoadScan = (trip: Trip) => {
    setActiveLoadTrip(trip)
    setActiveVehicleQr(null)
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
      if (code.startsWith(TRIP_QR_PREFIX)) {
        if (!activeVehicleQr) {
          const resolved = await tripsApi.resolveQr(code)
          if (resolved.manifest.tripId !== activeLoadTrip.tripId) {
            throw new Error('QR xe không khớp với chuyến đang mở.')
          }
          setActiveVehicleQr(code)
          setScanModalNotice('Đã mở QR xe. Hãy quét từng sack để chất lên xe.')
        } else {
          const res = await tripsApi.departByQr(code)
          setNotice(`Đã quét QR xe lần hai. Xuất kho hoàn tất với ${res.loadedCount} sack; xe đang vận chuyển.`)
          setLoadScanOpen(false)
          setActiveVehicleQr(null)
          load()
        }
      } else {
        if (!activeVehicleQr) throw new Error('Hãy quét QR xe trước khi quét sack.')
        const res = await tripsApi.loadSack(activeLoadTrip.tripId, code)
        setScanModalNotice(`Đã chất sack ${code} thành công. Hiện có ${res.loadedCount} sack trên chuyến.`)
        setActiveLoadTrip((prev) => prev ? { ...prev, sackCount: res.loadedCount } : null)
        load()
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
       <div className="grid gap-4 xl:grid-cols-6">
        {TRIP_COLUMNS.map((status) => <Card key={status} className="flex flex-col"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">{tripColumnLabel(status)}</CardTitle><Badge status={status}>{grouped[status]?.length ?? 0}</Badge></div><CardDescription>{tripColumnLabel(status)}</CardDescription></CardHeader><CardContent className="flex flex-1 flex-col gap-3">
           {(grouped[status] ?? []).map((trip) => { const missingSackIds = getMissingSackIds(trip.tripId); return <div key={trip.tripId} className="rounded-lg border bg-slate-50 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><p className="font-mono text-xs font-semibold text-primary">{trip.tripId}</p><Badge status={trip.type}>{trip.type === 'Inbound' ? 'Nhập hàng' : 'Xuất hàng'}</Badge></div><p className="mt-2 text-sm font-medium">{getDriver(trip.employeeId)}</p><p className="text-xs text-slate-500">{getCar(trip.carId)}</p><div className="mt-3 flex items-center gap-1 text-xs text-slate-600"><span className="truncate">{getLocation(trip.origin)}</span><ArrowRight className="h-3 w-3 shrink-0" /><span className="truncate">{getLocation(trip.destination)}</span></div>{trip.status === 'CompletedWithMissing' ? <p className="mt-3 flex items-start gap-1 text-xs font-medium text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Thiếu {missingSackIds.length} bao: <span className="font-mono">{missingSackIds.join(', ') || 'Đang tải danh sách'}</span></p> : <p className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-700"><PackageCheck className="h-4 w-4 text-primary" />{trip.sackCount ?? 0} bao hàng trong chuyến</p>}<div className="mt-3 grid gap-2">
            {trip.type === 'Outbound' && trip.status === 'Loading' && (
              <Button size="sm" onClick={() => openLoadScan(trip)}><PackagePlus className="h-4 w-4" />Quét chất hàng</Button>
            )}
              <Button size="sm" variant="outline" onClick={() => void showTripSacks(trip)}>{trip.status === 'CompletedWithMissing' ? 'Xem chi tiết thiếu hàng' : 'Xem danh sách sack'}</Button>
              {trip.status !== 'Cancelled' && trip.status !== 'Completed' && (
                 <Button size="sm" onClick={() => handlePrintTripQr(trip)}><Printer className="h-4 w-4" />{trip.type === 'Outbound' && trip.status === 'Loading' ? 'Cấp/In QR xe' : 'Cấp/In lại QR'}</Button>
              )}
           </div><p className="mt-2 text-[11px] text-slate-400">Tạo {formatDateTime(trip.createdAt)}</p></div>})}
          {(grouped[status] ?? []).length === 0 && <p className="py-8 text-center text-xs text-slate-400">Chưa có chuyến</p>}
        </CardContent></Card>)}
      </div>

      {/* Dialog tạo chuyến xe */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo chuyến xe" description={form.type === 'Outbound' ? 'Tạo chuyến ở trạng thái đang chất hàng. Bao sẽ được gán bằng quét mã.' : 'Hệ thống tự sinh mã chuyến và gán các bao đã chọn.'}><form className="space-y-4" onSubmit={createTrip}>
         <div className="grid gap-4 sm:grid-cols-2"><div><Label>Loại chuyến</Label><Select value={form.type} onChange={(event) => changeTripType(event.target.value as CreateTripRequest['type'])}><option value="Inbound">Nhập hàng</option><option value="Outbound">Xuất hàng</option></Select></div><div><Label>Tài xế</Label><Select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>{availableEmployees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeName}</option>)}</Select></div></div>
         {form.type === 'Outbound' && (
           <div>
             <Label>Đơn outbound</Label>
             <Select value={form.outboundOrderId ?? ''} onChange={(event) => selectOutboundOrder(event.target.value)}>
               <option value="">Chọn đơn outbound</option>
               {outboundOrders.filter((order) => !['Completed', 'Cancelled', 'Fulfilled'].includes(order.status)).map((order) => (
                 <option key={order.outboundOrderId} value={order.outboundOrderId}>
                   {order.outboundOrderNumber} · {order.outboundDestination} · {statusLabel(order.status)}
                 </option>
               ))}
             </Select>
             <p className="mt-1 text-xs text-slate-500">Chỉ bao đã được gán vào đơn này mới được phép chất lên chuyến.</p>
           </div>
         )}
        <div><Label>Phương tiện</Label><Select value={form.carId} onChange={(event) => setForm({ ...form, carId: event.target.value })}>{cars.map((car) => <option key={car.carId} value={car.carId}>{car.carId} · {car.carType}</option>)}</Select></div>
         <div className="grid gap-4 sm:grid-cols-2"><div><Label>Điểm đi</Label><Select value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })}>{originOptions.map((location) => <option key={location.locationId} value={location.locationId}>{location.locationName}</option>)}</Select></div><div><Label>Điểm đến</Label><Select value={form.destination} disabled={form.type === 'Outbound' && Boolean(form.outboundOrderId)} onChange={(event) => setForm({ ...form, destination: event.target.value })}>{selectableDestinations.map((location) => <option key={location.locationId} value={location.locationId}>{location.locationName}</option>)}</Select>{form.type === 'Outbound' && <p className="mt-1 text-xs text-slate-500">Zone B đi tới location nội tỉnh; Zone C đi tới hub next hop.</p>}</div></div>
        {form.type === 'Inbound' && (
          <div><div className="mb-2 flex items-center justify-between"><Label>Bao đã gán</Label><span className="text-xs text-slate-500">{form.sackIds.length} đã chọn</span></div><div className="max-h-52 overflow-y-auto rounded-md border border-slate-200 p-2">{availableSacks.map((sack) => <label key={sack.sackId} className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-slate-50"><input type="checkbox" checked={form.sackIds.includes(sack.sackId)} onChange={() => toggleSack(sack.sackId)} /><span className="font-mono text-xs font-medium">{sack.sackId}</span><span className="ml-auto text-xs text-slate-500">{sack.sDestination}</span></label>)}{availableSacks.length === 0 && <p className="p-3 text-center text-sm text-slate-500">Không có bao hàng trống để gán.</p>}</div></div>
        )}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo chuyến xe'}</Button></div>
      </form></Dialog>

      {/* Dialog danh sách bao hàng trong chuyến */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} title={selectedTrip ? `Bao hàng trong ${selectedTrip.tripId}` : 'Bao hàng'} description={`${tripSacks.length} bao hàng được gán cho chuyến này.`}><div className="max-h-80 space-y-2 overflow-y-auto">{tripSacks.map((sack) => <div key={sack.sackId} className="flex items-center justify-between rounded-md border px-3 py-2"><div><p className="font-mono text-sm font-medium">{sack.sackId}</p><p className="text-xs text-slate-500">Điểm đến: {sack.sDestination}</p></div><Badge status={sack.status}>{statusLabel(sack.status)}</Badge></div>)}{tripSacks.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Chuyến này chưa có bao hàng.</p>}</div></Dialog>

      <Dialog open={qrConfirmTrip !== null} onClose={() => setQrConfirmTrip(null)} title="Cấp/In lại QR chuyến" description={qrConfirmTrip ? `Chuyến ${qrConfirmTrip.tripId}` : undefined}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">Cấp lại QR sẽ làm QR đã in trước đó hết hiệu lực.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setQrConfirmTrip(null)}>Hủy</Button>
            <Button onClick={confirmQrIssue}><Printer className="h-4 w-4" />Cấp lại QR</Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog QR token chuyến xe */}
      <Dialog open={resultTripId !== null} onClose={closeResultDialog} title={`QR chuyến ${resultTripId ?? ''}`} description="Dùng QR này để mở phiên chất hàng tại hub xuất phát và đối chiếu hàng tại điểm đích.">
        {qrLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Đang cấp QR chuyến...</p>
          </div>
        )}
        {!qrLoading && qrError && resultTripId && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Không thể cấp QR chuyến</p>
                <p className="mt-1 text-sm">{qrError}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeResultDialog}>Đóng</Button>
              <Button onClick={() => void issueQrToken(resultTripId)}><Loader2 className="h-4 w-4" />Thử lại</Button>
            </div>
          </div>
        )}
        {!qrLoading && !qrError && resultQrToken && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-3 text-xs space-y-1">
              <p><strong>Mã chuyến:</strong> <span className="font-mono text-primary font-semibold">{resultQrToken.tripId}</span></p>
              <p><strong>Tài xế:</strong> {resultQrToken.driverName}</p>
              <p><strong>Phương tiện:</strong> {resultQrToken.carInfo}</p>
              <p><strong>Điểm đi:</strong> {resultQrToken.originName}</p>
              <p><strong>Điểm đến:</strong> {resultQrToken.destinationName}</p>
              <p><strong>Tổng số bao:</strong> {resultQrToken.sackCount}</p>
              <p><strong>QR hết hạn:</strong> {formatDateTime(resultQrToken.expiresAt)}</p>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Cấp lại QR sẽ làm QR đã in trước đó hết hiệu lực.</p>
            </div>
            <div className="flex justify-center">
              <div className="rounded-lg border p-3" dangerouslySetInnerHTML={{ __html: new BrowserQRCodeSvgWriter().write(resultQrToken.qrValue, 240, 240).outerHTML }} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeResultDialog}>Đóng</Button>
              <Button onClick={() => printTripQr(resultQrToken)}><Printer className="h-4 w-4" />In QR chuyến</Button>
            </div>
          </div>
        )}
      </Dialog>

       {/* Dialog quét chất hàng (Outbound Loading) */}
      <Dialog
        open={loadScanOpen}
        onClose={() => setLoadScanOpen(false)}
        title={activeLoadTrip ? `Quét chất hàng - ${activeLoadTrip.tripId}` : 'Quét chất hàng'}
         description={activeVehicleQr
           ? 'Đã mở QR xe. Quét từng sack để chất hàng, sau đó quét lại QR xe để hoàn tất xuất kho.'
           : 'Quét QR xe đầu tiên để mở phiên chất hàng.'}
      >
        <form onSubmit={handleScanSubmit} className="space-y-4">
          {(scanModalError || scanModalNotice) && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${scanModalError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {scanModalError ?? scanModalNotice}
            </div>
          )}

          <div className="rounded-lg border bg-slate-50 p-3 text-xs space-y-1">
             <p><strong>QR xe:</strong> {activeVehicleQr ? <span className="font-medium text-emerald-700">Đã mở phiên</span> : <span className="text-amber-600 font-medium">Chưa quét</span>}</p>
             <p><strong>Số bao đã chất:</strong> <span className="font-semibold text-primary">{activeLoadTrip?.sackCount ?? 0} bao</span></p>
          </div>

          <div>
             <Label>Ô quét mã (QR xe hoặc mã sack)</Label>
            <div className="mt-1 flex gap-2">
              <Input
                ref={scanInputRef}
                value={scanCodeInput}
                onChange={(e) => setScanCodeInput(e.target.value)}
                 placeholder={activeVehicleQr ? 'Quét mã sack hoặc quét lại QR xe...' : 'Quét QR WMS-TRIP-QR:...'}
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
