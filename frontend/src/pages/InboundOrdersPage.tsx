import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera, CheckCircle2, ChevronRight, CircleAlert,
  ListChecks, Package, QrCode, RotateCcw, ScanLine, Truck, XCircle,
} from 'lucide-react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import {
  inboundOrdersApi, palletsApi, tripsApi,
  type TripCheckInResult, type TripQrCheckInResult,
} from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, Drawer } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { cn, formatDateTime, statusLabel } from '@/lib/utils'
import type { InboundOrder, InboundOrderItem, TripQrManifest } from '@/types'

/* ─── Types ───────────────────────────────────────────────────────────────── */

type InboundStep = 'idle' | 'pallet-scan' | 'scanning'
type SackFilter = 'all' | 'scanned' | 'missing' | 'wrong'

type ScanResult = {
  id: number
  code: string
  message: string
  success: boolean
  at: Date
}

type InboundCheckInResult = Partial<TripCheckInResult> & Partial<TripQrCheckInResult> & {
  tripId: string
  carId: string
  status: string
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function parseTripManifest(value: string): TripQrManifest | null {
  try {
    const parsed = JSON.parse(value) as Partial<TripQrManifest>
    if (
      !parsed.tripId ||
      !Array.isArray(parsed.sacks)
    ) return null
    return parsed as TripQrManifest
  } catch {
    return null
  }
}

function formatTripQrResult(trip: InboundCheckInResult) {
  const count = trip.sackCount ?? trip.receivedCount ?? 0
  const missingCount = trip.missingSackIds?.length ?? 0
  const action = `${count} bao đã đưa vào ${trip.zoneName ?? trip.zoneId ?? 'zone nhập kho'}`
  const suffix = missingCount > 0
    ? ` Còn thiếu ${missingCount} bao: ${trip.missingSackIds?.join(', ')}.`
    : ' Đã đến đủ hàng.'
  return `Xe ${trip.carId} (${trip.tripId}) đã nhập kho. ${action}.${suffix}`
}

/* ─── Step indicator ──────────────────────────────────────────────────────── */

function StepIndicator({ step }: { step: InboundStep }) {
  const steps: Array<{ id: InboundStep; label: string }> = [
    { id: 'idle', label: 'Quét xe' },
    { id: 'pallet-scan', label: 'Quét pallet' },
    { id: 'scanning', label: 'Quét sacks' },
  ]
  const currentIndex = steps.findIndex((s) => s.id === step)
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
            i < currentIndex ? 'bg-emerald-500 text-white' :
            i === currentIndex ? 'bg-primary text-white' :
            'bg-slate-200 text-slate-500'
          }`}>
            {i < currentIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={`text-xs font-medium ${
            i === currentIndex ? 'text-primary' :
            i < currentIndex ? 'text-emerald-600' :
            'text-slate-400'
          }`}>{s.label}</span>
          {i < steps.length - 1 && <ChevronRight className="mx-0.5 h-3 w-3 text-slate-300" />}
        </div>
      ))}
    </div>
  )
}

/* ─── Main page ───────────────────────────────────────────────────────────── */

export default function InboundOrdersPage() {
  /* ── Order list state */
  const [orders, setOrders] = useState<InboundOrder[]>([])
  const [selected, setSelected] = useState<InboundOrder | null>(null)
  const [items, setItems] = useState<InboundOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  /* ── QR dialog open/close */
  const [qrDialogOpen, setQrDialogOpen] = useState(false)

  /* ── Scan history */
  const [results, setResults] = useState<ScanResult[]>([])
  const [lastCheckIn, setLastCheckIn] = useState<InboundCheckInResult | null>(null)

  /* ── Camera */
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)

  /* ── Inbound wizard */
  const [inboundStep, setInboundStep] = useState<InboundStep>('idle')
  const [tripManifest, setTripManifest] = useState<TripQrManifest | null>(null)
  const [vehicleInput, setVehicleInput] = useState('')
  const [palletInput, setPalletInput] = useState('')
  const [selectedPalletId, setSelectedPalletId] = useState('')
  const [sackInput, setSackInput] = useState('')
  const [scannedSackIds, setScannedSackIds] = useState<string[]>([])
  const [wrongSackIds, setWrongSackIds] = useState<string[]>([])
  const [sackFilter, setSackFilter] = useState<SackFilter>('all')
  const [processing, setProcessing] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)

  /* ── Refs for auto-focus per step */
  const vehicleInputRef = useRef<HTMLInputElement>(null)
  const palletInputRef = useRef<HTMLInputElement>(null)
  const sackInputRef = useRef<HTMLInputElement>(null)

  /* ─── Fetch orders ────────────────────────────────────────────────── */

  const fetchOrders = useCallback(async () => {
    try {
      const data = await inboundOrdersApi.all()
      setOrders(data)
      setError(null)
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  /* ─── Auto-focus per step ─────────────────────────────────────────── */

  useEffect(() => {
    if (!qrDialogOpen) return
    const t = setTimeout(() => {
      if (inboundStep === 'idle') vehicleInputRef.current?.focus()
      else if (inboundStep === 'pallet-scan') palletInputRef.current?.focus()
      else sackInputRef.current?.focus()
    }, 80)
    return () => clearTimeout(t)
  }, [qrDialogOpen, inboundStep])

  /* ─── Camera ──────────────────────────────────────────────────────── */

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setCameraOpen(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  useEffect(() => {
    if (!qrDialogOpen) { stopCamera(); resetWizard() }
  }, [qrDialogOpen, stopCamera])

  const startCamera = async () => {
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
        (result, _error, controls) => {
          if (!result) return
          const text = result.getText().trim()
          if (!text) return
          controls.stop()
          scannerControlsRef.current = null
          setCameraOpen(false)
          // Fill the right input based on current step
          if (inboundStep === 'idle') {
            setVehicleInput(text)
            setTimeout(() => void handleVehicleScan(text), 100)
          } else if (inboundStep === 'pallet-scan') {
            setPalletInput(text)
          } else if (inboundStep === 'scanning') {
            setSackInput(text)
            setTimeout(() => void handleSackScan(text), 100)
          }
        },
      )
    } catch (err: unknown) {
      setCameraError(err instanceof Error ? err.message : 'Không thể truy cập camera.')
    }
  }

  /* ─── Wizard helpers ──────────────────────────────────────────────── */

  const resetWizard = () => {
    setInboundStep('idle')
    setTripManifest(null)
    setVehicleInput('')
    setPalletInput('')
    setSelectedPalletId('')
    setSackInput('')
    setScannedSackIds([])
    setWrongSackIds([])
    setSackFilter('all')
  }

  const addResult = (code: string, message: string, success: boolean) => {
    setResults((prev) => [{ id: Date.now(), code, message, success, at: new Date() }, ...prev].slice(0, 8))
  }

  /* ─── Step 1: quét xe ────────────────────────────────────────────── */

  const handleVehicleScan = async (code?: string) => {
    const scannedCode = (code ?? vehicleInput).trim()
    if (!scannedCode || processing) return
    setProcessing(true)
    try {
      let manifest: TripQrManifest | null = null

      if (scannedCode.startsWith('WMS-TRIP-QR:')) {
        const resolveResult = await tripsApi.resolveQr(scannedCode)
        manifest = resolveResult.manifest
      } else {
        manifest = parseTripManifest(scannedCode)
      }

      if (!manifest) {
        throw new Error('Mã vừa quét không hợp lệ. Hãy quét mã QR từ tờ manifest của xe.')
      }
      setTripManifest(manifest)
      setScannedSackIds([])
      setWrongSackIds([])
      setPalletInput('')
      setSelectedPalletId('')
      setSackFilter('all')
      setInboundStep('pallet-scan')
      addResult(manifest.tripId, `Chuyến xe ${manifest.tripId} đã đến. Manifest có ${manifest.sacks.length} bao. Tiếp tục quét pallet.`, true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể đọc QR chuyến xe.'
      addResult(scannedCode, msg, false)
    } finally {
      setVehicleInput('')
      setProcessing(false)
    }
  }

  const handleVehicleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleVehicleScan()
  }

  /* ─── Step 2: quét pallet ────────────────────────────────────────── */

  const handlePalletSubmit = (e: FormEvent) => {
    e.preventDefault()
    const palletId = palletInput.trim()
    setSelectedPalletId(palletId)
    if (palletId) addResult(palletId, `Pallet ${palletId} đã được chọn.`, true)
    setInboundStep('scanning')
  }

  /* ─── Step 3: quét sack ──────────────────────────────────────────── */

  const handleSackScan = async (code?: string) => {
    const scannedCode = (code ?? sackInput).trim()
    if (!scannedCode || processing || !tripManifest) return
    setProcessing(true)
    try {
      if (scannedSackIds.includes(scannedCode)) {
        addResult(scannedCode, 'Bao này đã được quét rồi.', false)
        return
      }
      if (wrongSackIds.includes(scannedCode)) {
        addResult(scannedCode, 'Bao này đã được ghi nhận là không thuộc chuyến.', false)
        return
      }
      const isExpected = tripManifest.sacks.includes(scannedCode)
      if (!isExpected) {
        setWrongSackIds((prev) => [...prev, scannedCode])
        addResult(scannedCode, '⚠️ Bao KHÔNG thuộc chuyến xe này! Kiểm tra lại.', false)
        return
      }
      if (selectedPalletId) {
        await palletsApi.assignSack(selectedPalletId, scannedCode)
      }
      const newScanned = [...scannedSackIds, scannedCode]
      setScannedSackIds(newScanned)
      const remaining = tripManifest.sacks.length - newScanned.length
      addResult(scannedCode, remaining > 0 ? `Đã nhận bao. Còn ${remaining} bao chưa quét.` : '✅ Đã quét đủ tất cả bao!', true)
    } catch (err: unknown) {
      addResult(scannedCode, err instanceof Error ? err.message : 'Lỗi khi xử lý bao hàng.', false)
    } finally {
      setSackInput('')
      setProcessing(false)
    }
  }

  const handleSackSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSackScan()
  }

  /* ─── Xác nhận nhập kho ───────────────────────────────────────────── */

  const handleInboundConfirm = async () => {
    if (!tripManifest || checkingIn) return
    setCheckingIn(true)
    try {
      const result = await tripsApi.checkInByQr(tripManifest.tripId, scannedSackIds)
      const checkInResult: InboundCheckInResult = {
        tripId: result.tripId, carId: result.carId, status: result.status,
        receivedCount: result.receivedCount, sackCount: result.receivedCount,
        zoneName: result.zoneName, zoneId: result.zoneId,
        missingSackIds: result.missingSackIds, unexpectedSackIds: result.unexpectedSackIds,
      }
      setLastCheckIn(checkInResult)
      addResult(result.tripId, formatTripQrResult(checkInResult), result.missingSackIds.length === 0)
      fetchOrders()
      resetWizard()
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : 'Không thể xác nhận nhập kho.'
      try { const p = JSON.parse(msg) as { message?: string }; if (p.message) msg = p.message } catch { /* plain */ }
      addResult(tripManifest.tripId, msg, false)
    } finally {
      setCheckingIn(false)
    }
  }

  /* ─── Order detail ────────────────────────────────────────────────── */

  const openDetail = async (order: InboundOrder) => {
    setSelected(order)
    try {
      const data = await inboundOrdersApi.withItems(order.inboundOrderId)
      setItems(data.items)
    } catch { setItems([]) }
  }

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(true)
    try {
      await inboundOrdersApi.updateStatus(orderId, newStatus)
      await fetchOrders()
      if (selected?.inboundOrderId === orderId)
        setSelected((prev) => (prev ? { ...prev, status: newStatus } : null))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.')
    } finally { setUpdatingStatus(false) }
  }

  /* ─── Derived checklist values ────────────────────────────────────── */

  const expectedSacks = tripManifest?.sacks ?? []
  const scannedCount = scannedSackIds.length
  const totalExpected = expectedSacks.length
  const progressPct = totalExpected > 0 ? Math.round((scannedCount / totalExpected) * 100) : 0
  const allScanned = scannedCount === totalExpected && totalExpected > 0

  const filteredSacks = expectedSacks.filter((s) => {
    if (sackFilter === 'scanned') return scannedSackIds.includes(s)
    if (sackFilter === 'missing') return !scannedSackIds.includes(s)
    if (sackFilter === 'wrong') return wrongSackIds.includes(s)
    return true
  })

  const filterCounts = {
    all: expectedSacks.length + wrongSackIds.length,
    scanned: scannedCount,
    missing: totalExpected - scannedCount,
    wrong: wrongSackIds.length,
  }

  /* ─── Render ──────────────────────────────────────────────────────── */

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Quản lý đơn nhập kho"
        description="Tiếp nhận hàng hóa, theo dõi các chuyến xe nhập và mã bao hàng."
        action={
          <Button onClick={() => setQrDialogOpen(true)}>
            <QrCode className="h-4 w-4 mr-1.5" />
            Quét QR Inbound
          </Button>
        }
      />

      {/* ── Order table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách đơn nhập kho ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Nhà cung cấp</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thời điểm tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.inboundOrderId}
                  className={cn('cursor-pointer hover:bg-slate-50 transition-colors', selected?.inboundOrderId === order.inboundOrderId && 'bg-blue-50')}
                  onClick={() => openDetail(order)}
                >
                  <TableCell className="font-medium font-mono">{order.inboundOrderNumber}</TableCell>
                  <TableCell>{order.inboundSuplierName}</TableCell>
                  <TableCell><Badge status={order.status}>{statusLabel(order.status)}</Badge></TableCell>
                  <TableCell>{formatDateTime(order.createAt)}</TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-slate-500">Chưa có đơn nhập kho nào.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Order detail drawer ── */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `Chi tiết đơn ${selected.inboundOrderNumber}` : 'Chi tiết đơn hàng'}>
        {selected && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 rounded-lg border bg-slate-50 p-4">
              <div>
                <p className="text-xs text-slate-500 font-medium">Nhà cung cấp</p>
                <p className="font-semibold text-slate-900 mt-0.5">{selected.inboundSuplierName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Trạng thái hiện tại</p>
                <div className="mt-1"><Badge status={selected.status}>{statusLabel(selected.status)}</Badge></div>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Mã đơn nhập</p>
                <p className="font-mono text-sm font-semibold text-slate-900 mt-0.5">{selected.inboundOrderNumber}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Ngày tạo</p>
                <p className="text-sm text-slate-700 mt-0.5">{formatDateTime(selected.createAt)}</p>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm font-semibold mb-2">Cập nhật trạng thái đơn nhập</p>
              <div className="flex flex-wrap gap-2">
                {(['Pending', 'InProgress', 'Completed'] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={selected.status === s ? 'default' : 'outline'}
                    disabled={updatingStatus || selected.status === s}
                    onClick={() => handleUpdateStatus(selected.inboundOrderId, s)}
                  >
                    {s === 'Pending' ? 'Chờ xử lý' : s === 'InProgress' ? 'Đang nhập kho' : 'Hoàn thành'}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-slate-900">Danh sách bao thuộc đơn</h3>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg text-center">Chưa có bao hàng nào liên kết với đơn này.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã chi tiết (Item ID)</TableHead>
                      <TableHead>Mã bao hàng (Sack ID)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.inboundOrderItemId}>
                        <TableCell className="font-mono text-xs font-semibold">{item.inboundOrderItemId}</TableCell>
                        <TableCell className="font-mono text-xs text-blue-600 font-semibold">{item.sackId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* DIALOG: Quét QR Inbound                                        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={qrDialogOpen}
        onClose={() => setQrDialogOpen(false)}
        title="Quét QR Inbound nhập kho"
        description="Quét xe → quét pallet → quét từng bao để nhập kho."
        className="max-w-xl"
      >
        <div className="space-y-4">

          {/* Step indicator */}
          <div className="flex items-center justify-between">
            <StepIndicator step={inboundStep} />
            {inboundStep !== 'idle' && (
              <button
                type="button"
                onClick={resetWizard}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
              >
                <RotateCcw className="h-3 w-3" />
                Bắt đầu lại
              </button>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          {/* ── Bước 1: Quét xe ── */}
          {inboundStep === 'idle' && (
            <form onSubmit={handleVehicleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="vehicle-input" className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  Quét xe inbound
                </Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    ref={vehicleInputRef}
                    id="vehicle-input"
                    value={vehicleInput}
                    onChange={(e) => setVehicleInput(e.target.value)}
                    placeholder="Đưa máy quét vào tem QR trên xe..."
                    autoComplete="off"
                    disabled={processing}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant={cameraOpen ? 'default' : 'outline'}
                    onClick={cameraOpen ? stopCamera : startCamera}
                    title="Quét bằng camera"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  <Button type="submit" disabled={!vehicleInput.trim() || processing}>
                    {processing ? 'Đang đọc...' : 'Quét xe'}
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Quét mã QR trên tờ manifest dán ở xe để nhận danh sách bao hàng của chuyến.
                </p>
              </div>
            </form>
          )}

          {/* ── Bước 2: Quét pallet ── */}
          {inboundStep === 'pallet-scan' && tripManifest && (
            <div className="space-y-4">
              {/* Trip summary */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Chuyến xe đã nhận</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-slate-400">Mã chuyến</p>
                    <p className="font-mono text-xs font-bold text-slate-900">{tripManifest.tripId}</p>
                  </div>
                  
                  
                  <div>
                    <p className="text-[10px] text-slate-400">Số bao</p>
                    <p className="text-xs font-bold text-primary">{tripManifest.sacks.length} bao</p>
                  </div>
                </div>
              </div>

              {/* Pallet scan input */}
              <form onSubmit={handlePalletSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="pallet-input" className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    Quét pallet
                  </Label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      ref={palletInputRef}
                      id="pallet-input"
                      value={palletInput}
                      onChange={(e) => setPalletInput(e.target.value)}
                      placeholder="Quét hoặc nhập mã pallet..."
                      autoComplete="off"
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant={cameraOpen ? 'default' : 'outline'}
                      onClick={cameraOpen ? stopCamera : startCamera}
                      title="Quét bằng camera"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                    <Button type="submit" disabled={!palletInput.trim()}>
                      <ChevronRight className="h-4 w-4" />
                      Tiếp tục
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedPalletId(''); setPalletInput(''); setInboundStep('scanning') }}
                  >
                    Bỏ qua, không dùng pallet
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ── Bước 3: Quét sacks ── */}
          {inboundStep === 'scanning' && tripManifest && (
            <div className="space-y-4">
              {/* Info bar */}
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="text-slate-500">Chuyến:</span>
                  <span className="font-mono font-semibold text-slate-800 truncate">{tripManifest.tripId}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="text-slate-500">Pallet:</span>
                  {selectedPalletId
                    ? <span className="font-mono font-bold text-primary truncate">{selectedPalletId}</span>
                    : <span className="italic text-slate-400">Không chọn</span>
                  }
                  <button
                    type="button"
                    className="ml-auto text-[10px] text-slate-400 underline hover:text-slate-600"
                    onClick={() => { setPalletInput(selectedPalletId); setInboundStep('pallet-scan') }}
                  >
                    Đổi
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    <span className={allScanned ? 'text-emerald-600' : 'text-primary'}>{scannedCount}</span>
                    <span className="text-slate-400"> / {totalExpected} bao đã quét</span>
                  </span>
                  <span className={`font-bold ${allScanned ? 'text-emerald-600' : 'text-primary'}`}>{progressPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${allScanned ? 'bg-emerald-500' : 'bg-primary'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {wrongSackIds.length > 0 && (
                  <p className="mt-1 text-xs font-medium text-red-600">⚠️ {wrongSackIds.length} bao không thuộc chuyến này</p>
                )}
              </div>

              {/* Sack scan input */}
              <form onSubmit={handleSackSubmit}>
                <Label htmlFor="sack-input">Quét bao hàng (Sack)</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    ref={sackInputRef}
                    id="sack-input"
                    value={sackInput}
                    onChange={(e) => setSackInput(e.target.value)}
                    placeholder="Quét hoặc nhập mã SACK-..."
                    autoComplete="off"
                    disabled={processing}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant={cameraOpen ? 'default' : 'outline'}
                    onClick={cameraOpen ? stopCamera : startCamera}
                    title="Quét bằng camera"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  <Button type="submit" disabled={!sackInput.trim() || processing}>
                    <ScanLine className="h-4 w-4" />
                    {processing ? '...' : 'Quét'}
                  </Button>
                </div>
              </form>

              {/* Filter tabs */}
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                {([
                  { key: 'all', label: 'Tất cả' },
                  { key: 'scanned', label: '✅ Đã quét' },
                  { key: 'missing', label: '⬜ Còn thiếu' },
                  { key: 'wrong', label: '❌ Sai' },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSackFilter(tab.key)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold transition-colors ${
                      sackFilter === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                      sackFilter === tab.key ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {filterCounts[tab.key]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Checklist */}
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
                {sackFilter === 'wrong' && wrongSackIds.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">Không có bao ngoài danh sách.</div>
                ) : sackFilter === 'wrong' ? (
                  wrongSackIds.map((id) => (
                    <div key={id} className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5">
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      <p className="font-mono text-xs font-bold text-red-800 truncate">{id}</p>
                      <span className="ml-auto shrink-0 text-[10px] text-red-600">Không thuộc chuyến</span>
                    </div>
                  ))
                ) : filteredSacks.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">Không có bao nào trong bộ lọc này.</div>
                ) : (
                  filteredSacks.map((sack) => {
                    const isScanned = scannedSackIds.includes(sack)
                    return (
                      <div
                        key={sack}
                        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 transition-colors ${
                          isScanned ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        {isScanned
                          ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          : <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300" />
                        }
                        <p className={`font-mono text-xs font-bold truncate ${isScanned ? 'text-emerald-800' : 'text-slate-700'}`}>
                          {sack}
                        </p>
                        
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isScanned ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {isScanned ? 'Đã quét' : 'Chưa quét'}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Confirm button */}
              <Button
                className={`w-full ${allScanned ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                disabled={checkingIn || scannedCount === 0}
                onClick={() => void handleInboundConfirm()}
              >
                <ListChecks className="h-4 w-4" />
                {checkingIn
                  ? 'Đang xác nhận...'
                  : allScanned
                    ? 'Xác nhận nhập kho (đủ hàng)'
                    : `Xác nhận nhập kho (${scannedCount}/${totalExpected})`}
              </Button>
            </div>
          )}

          {/* ── Camera preview (inline) ── */}
          {cameraOpen && (
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-black">
              <video ref={videoRef} className="h-48 w-full object-cover" muted playsInline />
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-xs text-white">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Camera đang quét...
                </span>
                <button type="button" onClick={stopCamera} className="text-slate-400 hover:text-white">Tắt camera</button>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* ── Last check-in result ── */}
          {lastCheckIn && inboundStep === 'idle' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1">
652fce01594347f00281419fdec7fdd0a1b5f065
   </div>
          )}

          {/* ── Scan history ── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Lịch sử quét gần đây</p>
            {results.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-lg">Chưa có mã nào được quét trong phiên này.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-auto">
                {results.map((res) => (
                  <div
                    key={res.id}
                    className={cn(
                      'flex items-start justify-between rounded-lg border p-2 text-xs',
                      res.success ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold text-slate-900">{res.code}</span>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{res.message}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-2">{res.at.toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>Đóng</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
