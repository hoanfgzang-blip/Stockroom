import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader, BrowserQRCodeSvgWriter, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import {
  carsApi,
  employeesApi,
  locationsApi,
  outboundOrdersApi,
  tripsApi,
  type CreateTripRequest,
} from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, Drawer } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { cn, formatDateTime, statusLabel } from '@/lib/utils'
import type { Car, Employee, Location, OutboundOrder, OutboundOrderItem, Trip } from '@/types'
import { Button } from '@/components/ui/button'
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  CircleAlert,
  Loader2,
  PackagePlus,
  Plus,
  Printer,
  QrCode,
  ScanLine,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { Input, Label, Select } from '@/components/ui/input'
import { useAuth } from '@/auth/AuthContext'

// ─── Constants ──────────────────────────────────────────────────────────────
const TRIP_QR_PREFIX = 'WMS-TRIP-QR:'
const outboundStatuses = ['Pending', 'Reserved', 'Packing', 'Completed'] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escapeHtml(value: string | number) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
}

function getScanErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : 'Mã QR không hợp lệ hoặc không tồn tại.'
  try {
    const parsed = JSON.parse(rawMessage) as { message?: string }
    return parsed.message ?? rawMessage
  } catch {
    return rawMessage
  }
}

/** Tạo QR chứa tripId + sackId */
function makeSackQrValue(tripId: string, sackId: string) {
  return JSON.stringify({ type: 'WMS-SACK-ON-TRIP', tripId, sackId })
}

function printSackTripQr(tripId: string, sackId: string, destination: string) {
  const printWindow = window.open('', '_blank', 'width=560,height=700')
  if (!printWindow) return
  const qrValue = makeSackQrValue(tripId, sackId)
  const qrSvg = new BrowserQRCodeSvgWriter().write(qrValue, 280, 280).outerHTML
  printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>QR sack ${escapeHtml(sackId)}</title><style>body{font-family:Arial,sans-serif;padding:16px;color:#111;text-align:center}h2{font-size:14pt;margin:0 0 4mm}p{margin:2mm 0;font-size:10pt}.code{font:700 11pt monospace;word-break:break-all}svg{width:60mm;height:60mm}@page{size:auto;margin:8mm}</style></head><body><h2>WMS – Bao hàng trên chuyến xe</h2><p class="code">Sack: ${escapeHtml(sackId)}</p><p class="code">Chuyến: ${escapeHtml(tripId)}</p><p>Điểm đến: ${escapeHtml(destination)}</p>${qrSvg}<script>window.onload=()=>window.print();</script></body></html>`)
  printWindow.document.close()
}

const emptyTripForm = (): CreateTripRequest => ({
  employeeId: '',
  carId: '',
  origin: '',
  destination: '',
  type: 'Outbound',
  outboundOrderId: null,
  sackIds: [],
})

// ─── Component ───────────────────────────────────────────────────────────────
export default function OutboundOrdersPage() {
  const { user } = useAuth()

  // ── Data state ──────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<OutboundOrder[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cars, setCars] = useState<Car[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [dispatchDestinations, setDispatchDestinations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<string | null>(null)

  // ── Order detail drawer ──────────────────────────────────────────────────
  const [selected, setSelected] = useState<OutboundOrder | null>(null)
  const [items, setItems] = useState<OutboundOrderItem[]>([])

  // ── Create trip dialog ───────────────────────────────────────────────────
  const [createTripOpen, setCreateTripOpen] = useState(false)
  const [tripForm, setTripForm] = useState<CreateTripRequest>(emptyTripForm())
  const [tripSaving, setTripSaving] = useState(false)
  const [tripFormError, setTripFormError] = useState<string | null>(null)

  // ── Load scan dialog (after trip created) ───────────────────────────────
  const [loadScanOpen, setLoadScanOpen] = useState(false)
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null)
  /** Danh sách sack đã quét (mã sack thô) */
  const [scannedSacks, setScannedSacks] = useState<string[]>([])
  const [scanInput, setScanInput] = useState('')
  const [scanSubmitting, setScanSubmitting] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanNotice, setScanNotice] = useState<string | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  // ── Confirm dispatch step (scan trip QR 2nd time) ───────────────────────
  const [confirmDispatchOpen, setConfirmDispatchOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [dispatchSuccess, setDispatchSuccess] = useState<{ loadedCount: number } | null>(null)
  const confirmInputRef = useRef<HTMLInputElement>(null)

  // ── Camera ───────────────────────────────────────────────────────────────
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)

  // ── Camera for confirm step ───────────────────────────────────────────────
  const [confirmCameraOpen, setConfirmCameraOpen] = useState(false)
  const [confirmCameraError, setConfirmCameraError] = useState('')
  const confirmVideoRef = useRef<HTMLVideoElement>(null)
  const confirmScannerRef = useRef<IScannerControls | null>(null)

  // ─── Load data ──────────────────────────────────────────────────────────
  const loadData = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true)
    Promise.allSettled([
      outboundOrdersApi.allForDispatch(),
      employeesApi.all(),
      carsApi.all(),
      locationsApi.all(),
      locationsApi.dispatchDestinations(),
    ])
      .then(([ordersRes, empRes, carsRes, locsRes, destRes]) => {
        if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value)
        if (empRes.status === 'fulfilled') setEmployees(empRes.value)
        if (carsRes.status === 'fulfilled') setCars(carsRes.value)
        if (locsRes.status === 'fulfilled') setLocations(locsRes.value)
        if (destRes.status === 'fulfilled') setDispatchDestinations(destRes.value)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => { if (showSpinner) setLoading(false) })
  }, [])

  useEffect(() => { loadData(true) }, [loadData])

  // ─── Derived data ────────────────────────────────────────────────────────
  const statusTabs = useMemo(() => {
    const extraStatuses = orders
      .map((o) => o.status)
      .filter((s) => !outboundStatuses.includes(s as (typeof outboundStatuses)[number]))
    return [
      { value: null as string | null, label: 'Tất cả' },
      ...[...outboundStatuses, ...new Set(extraStatuses)].map((s) => ({ value: s, label: statusLabel(s) })),
    ]
  }, [orders])

  const visibleOrders = useMemo(
    () => [...orders]
      .filter((o) => activeStatus === null || o.status === activeStatus)
      .sort((a, b) => new Date(b.createAt).getTime() - new Date(a.createAt).getTime()),
    [activeStatus, orders],
  )

  const currentHubId = locations.some((l) => l.locationId === user?.locationId) ? (user?.locationId ?? '') : ''
  const availableEmployees = currentHubId ? employees.filter((e) => e.locationId === currentHubId) : employees
  const originOptions = currentHubId
    ? locations.filter((l) => l.locationId === currentHubId)
    : locations

  // ─── Order detail ────────────────────────────────────────────────────────
  const openDetail = async (order: OutboundOrder) => {
    setSelected(order)
    try {
      const data = await outboundOrdersApi.withItems(order.outboundOrderId)
      setItems(data.items)
    } catch {
      setItems([])
    }
  }

  // ─── Camera helpers ──────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setCameraOpen(false)
  }, [])

  const stopConfirmCamera = useCallback(() => {
    confirmScannerRef.current?.stop()
    confirmScannerRef.current = null
    setConfirmCameraOpen(false)
  }, [])

  useEffect(() => () => { stopCamera(); stopConfirmCamera() }, [stopCamera, stopConfirmCamera])

  const startCamera = async (onScanned: (value: string) => void) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt hoặc thiết bị này chưa hỗ trợ camera.')
      setCameraOpen(true)
      return
    }
    stopCamera()
    setCameraError('')
    setCameraOpen(true)
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const video = videoRef.current
      if (!video) throw new Error('Không thể mở màn hình xem trước camera.')
      const hints = new Map<DecodeHintType, BarcodeFormat[]>()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39])
      const reader = new BrowserMultiFormatReader(hints)
      scannerControlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        video,
        (result, _err, controls) => {
          if (!result) return
          const val = result.getText().trim()
          if (!val) return
          controls.stop()
          scannerControlsRef.current = null
          setCameraOpen(false)
          onScanned(val)
        },
      )
    } catch (err) {
      setCameraError(getScanErrorMessage(err))
    }
  }

  const startConfirmCamera = async (onScanned: (value: string) => void) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setConfirmCameraError('Trình duyệt hoặc thiết bị này chưa hỗ trợ camera.')
      setConfirmCameraOpen(true)
      return
    }
    stopConfirmCamera()
    setConfirmCameraError('')
    setConfirmCameraOpen(true)
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const video = confirmVideoRef.current
      if (!video) throw new Error('Không thể mở màn hình xem trước camera.')
      const hints = new Map<DecodeHintType, BarcodeFormat[]>()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39])
      const reader = new BrowserMultiFormatReader(hints)
      confirmScannerRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        video,
        (result, _err, controls) => {
          if (!result) return
          const val = result.getText().trim()
          if (!val) return
          controls.stop()
          confirmScannerRef.current = null
          setConfirmCameraOpen(false)
          onScanned(val)
        },
      )
    } catch (err) {
      setConfirmCameraError(getScanErrorMessage(err))
    }
  }

  // ─── Create trip ─────────────────────────────────────────────────────────
  const openCreateTrip = (order?: OutboundOrder) => {
    setTripFormError(null)
    const destId = order?.outboundDestination ?? dispatchDestinations[0]?.locationId ?? ''
    setTripForm({
      ...emptyTripForm(),
      employeeId: availableEmployees[0]?.employeeId ?? '',
      carId: cars[0]?.carId ?? '',
      origin: currentHubId || locations[0]?.locationId || '',
      destination: destId,
      outboundOrderId: order?.outboundOrderId ?? null,
    })
    setCreateTripOpen(true)
  }

  const selectOutboundOrder = (outboundOrderId: string) => {
    const order = orders.find((o) => o.outboundOrderId === outboundOrderId)
    setTripForm((prev) => ({
      ...prev,
      outboundOrderId: outboundOrderId || null,
      destination: order?.outboundDestination ?? prev.destination,
    }))
  }

  const handleCreateTrip = async (e: FormEvent) => {
    e.preventDefault()
    if (!tripForm.employeeId || !tripForm.carId || !tripForm.origin || !tripForm.destination) {
      setTripFormError('Hãy chọn đầy đủ tài xế, xe và điểm đi/đến.')
      return
    }
    if (tripForm.origin === tripForm.destination) {
      setTripFormError('Điểm đi và điểm đến không được trùng nhau.')
      return
    }
    if (!tripForm.outboundOrderId) {
      setTripFormError('Hãy chọn đơn outbound cho chuyến xe.')
      return
    }
    setTripSaving(true)
    setTripFormError(null)
    try {
      const created = await tripsApi.create(tripForm)
      setCreateTripOpen(false)
      // Mở phiên quét sack
      setActiveTrip(created)
      setScannedSacks([])
      setScanInput('')
      setScanError(null)
      setScanNotice(`Chuyến ${created.tripId} đã tạo. Hãy quét các sack để chất lên xe.`)
      setLoadScanOpen(true)
      setTimeout(() => scanInputRef.current?.focus(), 150)
      loadData(false)
    } catch (err) {
      setTripFormError(getScanErrorMessage(err))
    } finally {
      setTripSaving(false)
    }
  }

  // ─── Scan sack ────────────────────────────────────────────────────────────
  const processSackScan = async (rawCode: string) => {
    const code = rawCode.trim()
    if (!code || !activeTrip || scanSubmitting) return

    // Kiểm tra đã quét rồi
    if (scannedSacks.includes(code)) {
      setScanError(`Sack "${code}" đã được quét rồi.`)
      setScanInput('')
      return
    }

    setScanSubmitting(true)
    setScanError(null)
    setScanNotice(null)

    try {
      const res = await tripsApi.loadSack(activeTrip.tripId, code)
      setScannedSacks((prev) => [...prev, code])
      setScanNotice(`✓ Đã quét sack "${code}". Tổng: ${res.loadedCount} sack trên chuyến.`)
      setActiveTrip((prev) => prev ? { ...prev, sackCount: res.loadedCount } : null)
    } catch (err) {
      setScanError(getScanErrorMessage(err))
    } finally {
      setScanInput('')
      setScanSubmitting(false)
      setTimeout(() => scanInputRef.current?.focus(), 50)
    }
  }

  const handleScanSubmit = (e: FormEvent) => {
    e.preventDefault()
    void processSackScan(scanInput)
  }

  const removeSack = async (sackId: string) => {
    if (!activeTrip) return
    // Xoá sack khỏi danh sách đã quét (UI)
    setScannedSacks((prev) => prev.filter((s) => s !== sackId))
    setScanNotice(`Đã xoá sack "${sackId}" khỏi danh sách quét.`)
    setScanError(null)
  }

  // ─── Confirm dispatch (scan trip QR 2nd time) ────────────────────────────
  const openConfirmDispatch = () => {
    if (scannedSacks.length === 0) {
      setScanError('Chưa có sack nào được quét. Hãy quét ít nhất một sack trước khi kết thúc.')
      return
    }
    setConfirmInput('')
    setConfirmError(null)
    setDispatchSuccess(null)
    stopCamera()
    setLoadScanOpen(false)
    setConfirmDispatchOpen(true)
    setTimeout(() => confirmInputRef.current?.focus(), 150)
  }

  const handleConfirmDispatch = async (e: FormEvent) => {
    e.preventDefault()
    const code = confirmInput.trim()
    if (!code || !activeTrip || confirmSubmitting) return

    if (!code.startsWith(TRIP_QR_PREFIX)) {
      setConfirmError('Mã QR không hợp lệ. Vui lòng quét đúng QR chuyến xe (bắt đầu bằng WMS-TRIP-QR:).')
      return
    }

    setConfirmSubmitting(true)
    setConfirmError(null)
    try {
      const res = await tripsApi.departByQr(activeTrip.tripId, code)
      setDispatchSuccess({ loadedCount: res.loadedCount })
      loadData(false)
    } catch (err) {
      setConfirmError(getScanErrorMessage(err))
    } finally {
      setConfirmSubmitting(false)
    }
  }

  const closeConfirmDispatch = () => {
    stopConfirmCamera()
    setConfirmDispatchOpen(false)
    if (dispatchSuccess) {
      setActiveTrip(null)
      setScannedSacks([])
    }
    setDispatchSuccess(null)
  }

  const backToScan = () => {
    setConfirmDispatchOpen(false)
    setLoadScanOpen(true)
    setTimeout(() => scanInputRef.current?.focus(), 150)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) return <LoadingState />
  if (error && orders.length === 0) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Outbound – Xuất kho"
        description="Khởi tạo chuyến xe, quét sack và xác nhận xuất hàng bằng QR."
        action={
          <Button onClick={() => openCreateTrip()} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1.5" />
            Khởi tạo chuyến xe
          </Button>
        }
      />

      {/* Status filter tabs */}
      <div className="mb-6 overflow-x-auto pb-1">
        <div className="flex w-max min-w-full gap-1.5 rounded-xl border bg-white p-1.5 shadow-sm sm:gap-2 sm:p-2">
          {statusTabs.map((tab) => {
            const isActive = tab.value === activeStatus
            const count = tab.value === null ? orders.length : orders.filter((o) => o.status === tab.value).length
            return (
              <button
                key={tab.value ?? 'all'}
                type="button"
                onClick={() => setActiveStatus(tab.value)}
                aria-pressed={isActive}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors sm:h-10 sm:gap-2 sm:px-4 sm:text-sm',
                  isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                {tab.label}
                <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] font-semibold sm:px-2 sm:text-xs', isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-600')}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Orders table */}
      <Card>
        <CardHeader className="px-4 pt-5 sm:p-6 sm:pb-4">
          <CardTitle>{activeStatus === null ? 'Tất cả đơn xuất' : statusLabel(activeStatus)} ({visibleOrders.length})</CardTitle>
          <p className="text-sm text-slate-500">Đơn mới nhất được hiển thị ở trên cùng. Nhấn vào đơn để xem chi tiết hoặc khởi tạo chuyến xe.</p>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:p-6 sm:pt-0">
          {visibleOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Không có đơn xuất trong trạng thái này.</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead>Điểm đến</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Thời điểm tạo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleOrders.map((order) => (
                      <TableRow
                        key={order.outboundOrderId}
                        className={cn('cursor-pointer', selected?.outboundOrderId === order.outboundOrderId && 'bg-violet-50')}
                        onClick={() => openDetail(order)}
                      >
                        <TableCell className="font-medium">{order.outboundOrderNumber}</TableCell>
                        <TableCell>{order.outboundCustomerName}</TableCell>
                        <TableCell>{order.outboundDestination}</TableCell>
                        <TableCell>
                          <Badge status={order.status}>{statusLabel(order.status)}</Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(order.createAt)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); openCreateTrip(order) }}
                          >
                            <Truck className="h-3.5 w-3.5 mr-1" />
                            Tạo chuyến
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 lg:hidden">
                {visibleOrders.map((order) => (
                  <button
                    key={order.outboundOrderId}
                    type="button"
                    onClick={() => openDetail(order)}
                    className={cn(
                      'w-full rounded-lg border p-4 text-left transition-colors hover:bg-slate-50',
                      selected?.outboundOrderId === order.outboundOrderId && 'border-violet-200 bg-violet-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-all font-mono text-sm font-semibold text-slate-900">{order.outboundOrderNumber}</p>
                      <Badge status={order.status} className="shrink-0">{statusLabel(order.status)}</Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">Khách hàng</dt>
                        <dd className="mt-1 break-words font-medium text-slate-800">{order.outboundCustomerName}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">Điểm đến</dt>
                        <dd className="mt-1 break-words font-mono text-xs font-medium text-slate-800">{order.outboundDestination}</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={(e) => { e.stopPropagation(); openCreateTrip(order) }}
                      >
                        <Truck className="h-3.5 w-3.5 mr-1" />
                        Khởi tạo chuyến xe
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          Drawer: Chi tiết đơn hàng
      ════════════════════════════════════════════════════════════════════ */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Outbound ${selected.outboundOrderNumber}` : 'Chi tiết đơn hàng'}
      >
        {selected && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Khách hàng</p>
                <p className="font-medium">{selected.outboundCustomerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Điểm đến</p>
                <p className="font-medium">{selected.outboundDestination}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Trạng thái</p>
                <Badge status={selected.status}>{statusLabel(selected.status)}</Badge>
              </div>
            </div>
            <Button onClick={() => { setSelected(null); openCreateTrip(selected) }} className="w-full">
              <Truck className="h-4 w-4 mr-2" />
              Khởi tạo chuyến xe cho đơn này
            </Button>
            <div>
              <h3 className="mb-3 font-semibold">Sack trong đơn hàng</h3>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có sack nào trong đơn này.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã item</TableHead>
                      <TableHead>Mã sack</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.outboundOrderItemId}>
                        <TableCell className="font-mono text-xs">{item.outboundOrderItemId}</TableCell>
                        <TableCell className="font-mono text-xs">{item.sackId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ═══════════════════════════════════════════════════════════════════
          Dialog: Khởi tạo chuyến xe
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={createTripOpen}
        onClose={() => setCreateTripOpen(false)}
        title="Khởi tạo chuyến xe xuất kho"
        description="Tạo chuyến ở trạng thái Đang chất hàng. Sack sẽ được quét và gán sau khi tạo."
        className="max-w-lg"
      >
        <form onSubmit={handleCreateTrip} className="space-y-4">
          {tripFormError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{tripFormError}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Tài xế</Label>
              <Select
                value={tripForm.employeeId}
                onChange={(e) => setTripForm({ ...tripForm, employeeId: e.target.value })}
              >
                <option value="">Chọn tài xế</option>
                {availableEmployees.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>{emp.employeeName}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Phương tiện</Label>
              <Select
                value={tripForm.carId}
                onChange={(e) => setTripForm({ ...tripForm, carId: e.target.value })}
              >
                <option value="">Chọn xe</option>
                {cars.map((car) => (
                  <option key={car.carId} value={car.carId}>{car.carId} · {car.carType}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>Đơn outbound</Label>
            <Select
              value={tripForm.outboundOrderId ?? ''}
              onChange={(e) => selectOutboundOrder(e.target.value)}
            >
              <option value="">Chọn đơn outbound</option>
              {orders
                .filter((o) => !['Completed', 'Cancelled', 'Fulfilled'].includes(o.status))
                .map((o) => (
                  <option key={o.outboundOrderId} value={o.outboundOrderId}>
                    {o.outboundOrderNumber} · {o.outboundDestination} · {statusLabel(o.status)}
                  </option>
                ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Điểm đi</Label>
              <Select
                value={tripForm.origin}
                onChange={(e) => setTripForm({ ...tripForm, origin: e.target.value })}
              >
                <option value="">Chọn điểm đi</option>
                {originOptions.map((loc) => (
                  <option key={loc.locationId} value={loc.locationId}>{loc.locationName}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Điểm đến</Label>
              <Select
                value={tripForm.destination}
                disabled={Boolean(tripForm.outboundOrderId)}
                onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
              >
                <option value="">Chọn điểm đến</option>
                {dispatchDestinations.map((loc) => (
                  <option key={loc.locationId} value={loc.locationId}>{loc.locationName}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <p className="font-medium mb-1 flex items-center gap-1.5"><PackagePlus className="h-4 w-4" /> Sau khi tạo chuyến:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs">
              <li>Hệ thống mở phiên quét sack ngay lập tức</li>
              <li>Quét từng sack để chất lên chuyến xe</li>
              <li>Bấm "Kết thúc xuất hàng" và quét QR xe lần 2 để xác nhận</li>
            </ol>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateTripOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={tripSaving}>
              {tripSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang tạo...</> : <><Truck className="h-4 w-4 mr-2" />Tạo chuyến xe</>}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          Dialog: Quét sack
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={loadScanOpen}
        onClose={() => { stopCamera(); setLoadScanOpen(false) }}
        title={activeTrip ? `Quét sack – Chuyến ${activeTrip.tripId}` : 'Quét sack'}
        description="Quét mã sack để chất hàng lên chuyến xe. Nhấn xoá để hủy sack đã quét."
        className="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Thông báo */}
          {(scanError || scanNotice) && (
            <div className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm',
              scanError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
            )}>
              {scanError ? <CircleAlert className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
              <span>{scanError ?? scanNotice}</span>
            </div>
          )}

          {/* Thông tin chuyến */}
          <div className="rounded-lg border bg-slate-50 p-3 text-xs space-y-1">
            <p><strong>Mã chuyến:</strong> <span className="font-mono text-primary font-semibold">{activeTrip?.tripId}</span></p>
            <p><strong>Số sack đã quét:</strong> <span className="font-semibold text-primary">{scannedSacks.length} sack</span></p>
          </div>

          {/* Form quét */}
          <form onSubmit={handleScanSubmit} className="space-y-2">
            <Label htmlFor="sack-scan-input">Quét hoặc nhập mã sack</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="sack-scan-input"
                  ref={scanInputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Quét mã sack..."
                  disabled={scanSubmitting}
                  className="pr-9 font-mono"
                  autoComplete="off"
                />
                <ScanLine className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
              </div>
              <Button type="submit" disabled={scanSubmitting || !scanInput.trim()}>
                {scanSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Quét'}
              </Button>
              <Button
                type="button"
                variant={cameraOpen ? 'default' : 'outline'}
                onClick={cameraOpen ? stopCamera : () => void startCamera((val) => { setScanInput(val); void processSackScan(val) })}
                disabled={scanSubmitting}
                title="Mở camera quét sack"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          </form>

          {/* Camera preview */}
          {cameraOpen && (
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-black">
              <video ref={videoRef} className="h-48 w-full object-cover" muted playsInline />
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-xs text-white">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Camera đang quét sack...
                </span>
                <button type="button" onClick={stopCamera} className="text-slate-400 hover:text-white">Tắt camera</button>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Danh sách sack đã quét */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Sack đã quét ({scannedSacks.length})</h3>
            </div>
            {scannedSacks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
                <QrCode className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p>Chưa có sack nào được quét.</p>
                <p className="text-xs mt-1">Quét mã sack ở ô nhập phía trên.</p>
              </div>
            ) : (
              <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border bg-slate-50 p-2">
                {scannedSacks.map((sackId, index) => (
                  <div
                    key={sackId}
                    className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-sm shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                        {index + 1}
                      </span>
                      <span className="font-mono font-medium text-slate-800">{sackId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        title={`In QR sack ${sackId}`}
                        onClick={() => activeTrip && printSackTripQr(activeTrip.tripId, sackId, activeTrip.destination)}
                        className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        title={`Xoá sack ${sackId}`}
                        onClick={() => void removeSack(sackId)}
                        className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => { stopCamera(); setLoadScanOpen(false) }}>
              <X className="h-4 w-4 mr-1" />
              Đóng tạm
            </Button>
            <Button
              type="button"
              onClick={openConfirmDispatch}
              disabled={scannedSacks.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Kết thúc xuất hàng ({scannedSacks.length} sack)
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          Dialog: Xác nhận kết thúc xuất hàng (quét QR xe lần 2)
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={confirmDispatchOpen}
        onClose={closeConfirmDispatch}
        title="Xác nhận kết thúc xuất hàng"
        description={activeTrip ? `Chuyến ${activeTrip.tripId} · ${scannedSacks.length} sack đã quét` : ''}
        className="max-w-lg"
      >
        {dispatchSuccess ? (
          /* ─── Thành công ─── */
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <div>
                <p className="text-lg font-semibold">Xuất hàng thành công!</p>
                <p className="mt-1 text-sm">Chuyến xe đã khởi hành với <strong>{dispatchSuccess.loadedCount} sack</strong>.</p>
                <p className="mt-1 text-sm">Các sack đã được gỡ khỏi pallet và gán cho chuyến.</p>
              </div>
            </div>
            <Button onClick={closeConfirmDispatch} className="w-full">
              Hoàn tất
            </Button>
          </div>
        ) : (
          /* ─── Chờ quét QR ─── */
          <div className="space-y-4">
            {/* Tóm tắt sack */}
            <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1.5">
              <p className="font-medium text-slate-700 mb-2">Tóm tắt chuyến xe</p>
              <p><strong>Mã chuyến:</strong> <span className="font-mono text-primary">{activeTrip?.tripId}</span></p>
              <p><strong>Số sack:</strong> <span className="font-semibold">{scannedSacks.length} sack</span></p>
              <div className="mt-2 flex flex-wrap gap-1">
                {scannedSacks.map((s) => (
                  <span key={s} className="rounded bg-white border px-2 py-0.5 font-mono text-xs text-slate-700">{s}</span>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Quét QR chuyến xe <strong>lần 2</strong> để xác nhận xuất kho. Thao tác này sẽ:<br />
                • Chuyển trạng thái chuyến sang <strong>Đang vận chuyển</strong><br />
                • Gỡ các sack đã quét ra khỏi pallet
              </p>
            </div>

            {confirmError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <CircleAlert className="h-4 w-4 shrink-0" />
                <span>{confirmError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDispatch} className="space-y-2">
              <Label htmlFor="confirm-qr-input">Quét QR chuyến xe (WMS-TRIP-QR:...)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="confirm-qr-input"
                    ref={confirmInputRef}
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="Quét QR xe lần 2..."
                    disabled={confirmSubmitting}
                    className="pr-9 font-mono"
                    autoComplete="off"
                  />
                  <ScanLine className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
                </div>
                <Button type="submit" disabled={confirmSubmitting || !confirmInput.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {confirmSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Xác nhận'}
                </Button>
                <Button
                  type="button"
                  variant={confirmCameraOpen ? 'default' : 'outline'}
                  onClick={confirmCameraOpen
                    ? stopConfirmCamera
                    : () => void startConfirmCamera((val) => { setConfirmInput(val) })}
                  disabled={confirmSubmitting}
                  title="Mở camera quét QR xe"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
            </form>

            {/* Camera xác nhận */}
            {confirmCameraOpen && (
              <div className="overflow-hidden rounded-lg border border-slate-300 bg-black">
                <video ref={confirmVideoRef} className="h-48 w-full object-cover" muted playsInline />
                <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-xs text-white">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    Camera đang quét QR xe...
                  </span>
                  <button type="button" onClick={stopConfirmCamera} className="text-slate-400 hover:text-white">Tắt camera</button>
                </div>
              </div>
            )}

            {confirmCameraError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <CircleAlert className="h-4 w-4 shrink-0" />
                <span>{confirmCameraError}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <Button type="button" variant="outline" onClick={backToScan}>
                ← Quay lại quét sack
              </Button>
              <Button type="button" variant="outline" onClick={closeConfirmDispatch}>
                Hủy
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
