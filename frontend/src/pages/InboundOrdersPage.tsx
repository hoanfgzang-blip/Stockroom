import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, CircleAlert, PackagePlus, Plus, QrCode, ScanLine, X } from 'lucide-react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { inboundOrdersApi, palletsApi, tripsApi, zonesApi, type TripCheckInResult, type TripQrCheckInResult } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, Drawer } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { cn, formatDateTime, generatePreviewId, statusLabel } from '@/lib/utils'
import type { InboundOrder, InboundOrderItem, Pallet, Trip, TripQrManifest, Zone } from '@/types'

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

function parseTripManifest(value: string): TripQrManifest | null {
  try {
    const parsed = JSON.parse(value) as Partial<TripQrManifest>
    if (parsed.kind !== 'WMS_TRIP_MANIFEST' || parsed.version !== 1 || !parsed.tripId || !Array.isArray(parsed.sacks)) return null
    return parsed as TripQrManifest
  } catch {
    return null
  }
}

function formatTripQrResult(trip: InboundCheckInResult, manifest?: TripQrManifest | null) {
  const count = trip.sackCount ?? trip.receivedCount ?? 0
  const missingCount = trip.missingSackIds?.length ?? 0
  const action = manifest?.type === 'Outbound'
    ? `${count} bao đã được xác nhận nhận tại điểm đích`
    : `${count} bao đã đưa vào ${trip.zoneName ?? trip.zoneId ?? 'zone nhập kho'}`
  const suffix = missingCount > 0 ? ` Còn thiếu ${missingCount} bao: ${trip.missingSackIds?.join(', ')}.` : ' Đã đến đủ hàng.'
  return `Xe ${trip.carId} (Mã chuyến: ${trip.tripId}) đã check-in. ${action}.${suffix}`
}

// --- Pallet Panel Component ---
type PalletPanelProps = {
  pallets: Pallet[]
  zones: Zone[]
  selectedPalletId: string
  onSelectPallet: (id: string) => void
  onCreatePallet: (zoneId: string, palletId: string) => Promise<void>
  creating: boolean
}

function PalletPanel({ pallets, zones, selectedPalletId, onSelectPallet, onCreatePallet, creating }: PalletPanelProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newZoneId, setNewZoneId] = useState('')
  const [previewPalletId, setPreviewPalletId] = useState('')

  const selectedPallet = pallets.find((p) => p.palletId === selectedPalletId)

  const toggleCreating = (v?: boolean) => {
    const next = v !== undefined ? v : !isCreating
    setIsCreating(next)
    if (next) {
      setPreviewPalletId(generatePreviewId('PLT'))
    } else {
      setPreviewPalletId('')
    }
  }

  const handleCreate = async () => {
    if (!newZoneId || !previewPalletId || creating) return
    await onCreatePallet(newZoneId, previewPalletId)
    setIsCreating(false)
    setNewZoneId('')
    setPreviewPalletId('')
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <PackagePlus className="h-4 w-4 text-blue-600" />
          Pallet nhập kho
        </p>
        <Button
          type="button"
          size="sm"
          variant={isCreating ? 'destructive' : 'outline'}
          onClick={() => toggleCreating()}
          className="h-7 text-xs px-2.5"
        >
          {isCreating ? (
            <><X className="h-3.5 w-3.5 mr-1" />Hủy</>
          ) : (
            <><Plus className="h-3.5 w-3.5 mr-1" />Tạo Pallet mới</>
          )}
        </Button>
      </div>

      {/* Tạo pallet mới */}
      {isCreating && (
        <div className="rounded-lg border border-blue-300 bg-white p-3 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mã Pallet</Label>
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Tự động sinh mã
              </span>
            </div>
            <div className="flex h-9 w-full items-center rounded-lg border border-slate-300 bg-slate-50 px-3">
              <span className="font-mono text-xs font-semibold text-slate-700">{previewPalletId}</span>
            </div>
          </div>
          <div>
            <Label htmlFor="new-pallet-zone" className="text-xs">Zone đặt Pallet <span className="text-red-500">*</span></Label>
            <Select
              id="new-pallet-zone"
              value={newZoneId}
              onChange={(e) => setNewZoneId(e.target.value)}
              className="mt-1 h-9 text-xs"
            >
              <option value="">Chọn zone...</option>
              {zones.map((z) => (
                <option key={z.zoneId} value={z.zoneId}>
                  {z.zoneName} ({z.zoneType})
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!newZoneId || creating}
            onClick={handleCreate}
            className="w-full"
          >
            {creating ? 'Đang tạo...' : '✓ Xác nhận tạo Pallet mới'}
          </Button>
        </div>
      )}

      {/* Chọn pallet hiện có */}
      {!isCreating && (
        <div>
          <Label htmlFor="select-pallet" className="text-xs">Chọn Pallet</Label>
          <Select
            id="select-pallet"
            value={selectedPalletId}
            onChange={(e) => onSelectPallet(e.target.value)}
            className="mt-1 h-9 text-xs"
          >
            <option value="">-- Không chọn pallet --</option>
            {pallets.map((p) => (
              <option key={p.palletId} value={p.palletId}>
                {p.palletId} — {p.status} — Zone: {p.zoneId}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Thông tin read-only pallet đã chọn */}
      {selectedPallet && !isCreating && (
        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-white p-3">
          <div className="col-span-3">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Mã Pallet</p>
            <p className="text-xs font-mono font-semibold text-slate-900 mt-0.5">{selectedPallet.palletId}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Trạng thái</p>
            <Badge status={selectedPallet.status} className="mt-0.5 text-[10px]">
              {statusLabel(selectedPallet.status)}
            </Badge>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Zone</p>
            <p className="text-xs font-medium text-slate-700 mt-0.5 truncate">{selectedPallet.zoneId}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InboundOrdersPage() {
  const [orders, setOrders] = useState<InboundOrder[]>([])
  const [selected, setSelected] = useState<InboundOrder | null>(null)
  const [items, setItems] = useState<InboundOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // QR Scan dialog state
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<ScanResult[]>([])
  const [lastCheckIn, setLastCheckIn] = useState<InboundCheckInResult | null>(null)
  
  // Trip check-in state
  const [inboundTrips, setInboundTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState('')
  const [tripPallets, setTripPallets] = useState<string[]>([])
  const [tripPalletCount, setTripPalletCount] = useState(0)

  // Camera scanner state
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Pallet state
  const [pallets, setPallets] = useState<Pallet[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedPalletId, setSelectedPalletId] = useState('')
  const [palletCreating, setPalletCreating] = useState(false)
  const [palletLoaded, setPalletLoaded] = useState(false)

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

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Load pallets and zones when dialog opens
  useEffect(() => {
    if (qrDialogOpen && !palletLoaded) {
      Promise.allSettled([palletsApi.all(), zonesApi.all(), tripsApi.all()])
        .then(([palletsResult, zonesResult, tripsResult]) => {
          const loadedPallets = palletsResult.status === 'fulfilled' ? palletsResult.value : []
          const loadedZones = zonesResult.status === 'fulfilled' ? zonesResult.value : []
          const trips = tripsResult.status === 'fulfilled' ? tripsResult.value : []
          
          setPallets(loadedPallets)
          setZones(loadedZones)
          setInboundTrips(trips.filter(t => t.type === 'Inbound' && t.status.startsWith('Completed')))
          setPalletLoaded(true)
          // Auto-select the most recently created pallet (last in list, sorted by ID which contains timestamp)
          if (loadedPallets.length > 0) {
            const newest = [...loadedPallets].sort((a, b) => b.palletId.localeCompare(a.palletId))[0]
            setSelectedPalletId(newest.palletId)
          }
        })
        .catch(() => {
          setPallets([])
          setZones([])
          setInboundTrips([])
        })
    }
  }, [qrDialogOpen, palletLoaded])

  useEffect(() => {
    if (selectedTripId) {
      tripsApi.pallets(selectedTripId).then(res => {
        setTripPallets(res.pallets.map(p => p.palletId))
        setTripPalletCount(res.palletCount)
      }).catch(() => {
        setTripPallets([])
        setTripPalletCount(0)
      })
    } else {
      setTripPallets([])
      setTripPalletCount(0)
    }
  }, [selectedTripId])

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setCameraOpen(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  useEffect(() => {
    if (qrDialogOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      stopCamera()
      setPalletLoaded(false)
    }
  }, [qrDialogOpen, stopCamera])

  const openDetail = async (order: InboundOrder) => {
    setSelected(order)
    try {
      const data = await inboundOrdersApi.withItems(order.inboundOrderId)
      setItems(data.items)
    } catch {
      setItems([])
    }
  }

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(true)
    try {
      await inboundOrdersApi.updateStatus(orderId, newStatus)
      await fetchOrders()
      if (selected?.inboundOrderId === orderId) {
        setSelected((prev) => (prev ? { ...prev, status: newStatus } : null))
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái đơn hàng.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const addScanResult = (code: string, message: string, success: boolean) => {
    setResults((prev) => [{ id: Date.now(), code, message, success, at: new Date() }, ...prev].slice(0, 6))
  }

  const reloadPallets = async () => {
    try {
      const loadedPallets = await palletsApi.all()
      setPallets(loadedPallets)
      // After reload, select newest pallet
      if (loadedPallets.length > 0) {
        const newest = [...loadedPallets].sort((a, b) => b.palletId.localeCompare(a.palletId))[0]
        setSelectedPalletId(newest.palletId)
      }
    } catch {
      // ignore
    }
  }

  const handleCreatePallet = async (zoneId: string, palletId: string) => {
    setPalletCreating(true)
    try {
      const newPallet = await palletsApi.create({ zoneId, palletId })
      await reloadPallets()
      setSelectedPalletId(newPallet.palletId)
      addScanResult(newPallet.palletId, `Đã tạo Pallet mới. Mã: ${newPallet.palletId} — Zone: ${newPallet.zoneId}`, true)
    } catch (err: unknown) {
      addScanResult('TẠO-PALLET', err instanceof Error ? err.message : 'Không thể tạo Pallet mới.', false)
    } finally {
      setPalletCreating(false)
    }
  }

  const processCode = async (scannedCode: string) => {
    if (!scannedCode || processing) return
    setProcessing(true)
    try {
      if (selectedTripId) {
        if (tripPallets.includes(scannedCode)) {
          addScanResult(scannedCode, 'Pallet hợp lệ và thuộc chuyến xe này.', true)
        } else {
          addScanResult(scannedCode, 'Pallet không thuộc chuyến xe này.', false)
        }
        return
      }

      // Case 1: Check if scanned value is a JSON Trip QR Manifest
      const manifest = parseTripManifest(scannedCode)
      if (manifest) {
        const tripResult: InboundCheckInResult = await tripsApi.checkInByQr(manifest)
        setLastCheckIn(tripResult)
        setSelectedTripId(tripResult.tripId)
        addScanResult(tripResult.tripId, formatTripQrResult(tripResult, manifest), (tripResult.missingSackIds?.length ?? 0) === 0)
        fetchOrders()
        // After successful QR check-in, reload pallets and select newest
        await reloadPallets()
        return
      }

      // Case 2: Check if code corresponds to an existing Inbound Order ID or Number
      const matchingOrder = orders.find(
        (o) => o.inboundOrderId.toLowerCase() === scannedCode.toLowerCase() || o.inboundOrderNumber.toLowerCase() === scannedCode.toLowerCase(),
      )

      if (matchingOrder) {
        // Auto update order status if Pending
        if (matchingOrder.status === 'Pending') {
          await inboundOrdersApi.updateStatus(matchingOrder.inboundOrderId, 'InProgress')
          addScanResult(matchingOrder.inboundOrderNumber, `Đã nhận đơn nhập kho ${matchingOrder.inboundOrderNumber} (Chuyển sang Đang xử lý).`, true)
        } else {
          addScanResult(matchingOrder.inboundOrderNumber, `Tìm thấy đơn nhập kho ${matchingOrder.inboundOrderNumber} - Trạng thái: ${statusLabel(matchingOrder.status)}.`, true)
        }
        openDetail(matchingOrder)
        fetchOrders()
        return
      }

      // Case 3: Process as standard Trip check-in code
      const tripResult: InboundCheckInResult = await tripsApi.checkIn(scannedCode)
      setLastCheckIn(tripResult)
      setSelectedTripId(tripResult.tripId)
      addScanResult(tripResult.tripId, formatTripQrResult(tripResult), true)
      fetchOrders()
      // After successful check-in, reload pallets and select newest
      await reloadPallets()
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Mã đã quét không đúng định dạng hoặc không tồn tại.'
      // Try to parse JSON error message from server
      let msg = rawMsg
      try {
        const parsed = JSON.parse(rawMsg) as { message?: string }
        if (parsed.message) msg = parsed.message
      } catch {
        // rawMsg is plain text
      }
      addScanResult(scannedCode, msg, false)
    } finally {
      setBarcodeInput('')
      setProcessing(false)
    }
  }

  const handleProcessScan = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    await processCode(barcodeInput.trim())
  }

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
          const scannedText = result.getText().trim()
          if (!scannedText) return

          controls.stop()
          scannerControlsRef.current = null
          setCameraOpen(false)
          setBarcodeInput(scannedText)

          // Auto process scanned code
          setTimeout(() => {
            void processCode(scannedText)
          }, 100)
        },
      )
    } catch (err: unknown) {
      setCameraError(err instanceof Error ? err.message : 'Không thể truy cập camera.')
    }
  }

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
                  <TableCell>
                    <Badge status={order.status}>{statusLabel(order.status)}</Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(order.createAt)}</TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-slate-500">
                    Chưa có đơn nhập kho nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drawer xem chi tiết đơn nhập kho */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Chi tiết đơn ${selected.inboundOrderNumber}` : 'Chi tiết đơn hàng'}
      >
        {selected && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 rounded-lg border bg-slate-50 p-4">
              <div>
                <p className="text-xs text-slate-500 font-medium">Nhà cung cấp</p>
                <p className="font-semibold text-slate-900 mt-0.5">{selected.inboundSuplierName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Trạng thái hiện tại</p>
                <div className="mt-1">
                  <Badge status={selected.status}>{statusLabel(selected.status)}</Badge>
                </div>
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

            {/* Chuyển đổi trạng thái đơn nhập kho */}
            <div className="rounded-lg border p-4">
              <p className="text-sm font-semibold mb-2">Cập nhật trạng thái đơn nhập</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selected.status === 'Pending' ? 'default' : 'outline'}
                  disabled={updatingStatus || selected.status === 'Pending'}
                  onClick={() => handleUpdateStatus(selected.inboundOrderId, 'Pending')}
                >
                  Chờ xử lý (Pending)
                </Button>
                <Button
                  size="sm"
                  variant={selected.status === 'InProgress' ? 'default' : 'outline'}
                  disabled={updatingStatus || selected.status === 'InProgress'}
                  onClick={() => handleUpdateStatus(selected.inboundOrderId, 'InProgress')}
                >
                  Đang nhập kho (InProgress)
                </Button>
                <Button
                  size="sm"
                  variant={selected.status === 'Completed' ? 'default' : 'outline'}
                  disabled={updatingStatus || selected.status === 'Completed'}
                  onClick={() => handleUpdateStatus(selected.inboundOrderId, 'Completed')}
                >
                  Hoàn thành (Completed)
                </Button>
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-slate-900">Danh sách mã hàng / Bao thuộc đơn</h3>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg text-center">Chưa có mã hàng hoặc bao hàng nào liên kết với đơn này.</p>
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

      {/* Modal Dialog Quét QR Inbound */}
      <Dialog
        open={qrDialogOpen}
        onClose={() => setQrDialogOpen(false)}
        title="Quét QR Inbound nhập kho"
        description="Đưa mã QR chuyến xe hoặc nhập/quét mã bao hàng để thực hiện tiếp nhận vào kho."
        className="max-w-xl"
      >
        <div className="space-y-4">
          {/* Chọn chuyến xe Inbound */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="inbound-trip" className="text-xs">Chuyến xe Inbound</Label>
              {selectedTripId && (
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSelectedTripId('')}>
                  Đổi chuyến khác
                </Button>
              )}
            </div>
            <Select
              id="inbound-trip"
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="h-9 text-sm"
              disabled={processing}
            >
              <option value="">-- Quét mã QR chuyến xe mới hoặc chọn chuyến đã tới --</option>
              {inboundTrips.map((trip) => (
                <option key={trip.tripId} value={trip.tripId}>
                  {trip.tripId} - Xe {trip.carId}
                </option>
              ))}
            </Select>
            {selectedTripId && (
              <p className="mt-1.5 text-xs text-slate-500">
                Chuyến xe đang chọn có <span className="font-medium text-slate-700">{tripPalletCount}</span> pallet.
                {tripPallets.length > 0 && ` (${tripPallets.join(', ')})`}
              </p>
            )}
          </div>

          {/* Form quét / nhập mã vạch */}
          <form onSubmit={handleProcessScan} className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder={selectedTripId ? "Quét mã pallet để kiểm tra..." : "Quét mã QR chuyến xe, mã đơn hoặc mã bao..."}
                disabled={processing}
                className="font-mono pr-9"
              />
              <ScanLine className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
            </div>
            <Button type="submit" disabled={processing || !barcodeInput.trim()}>
              {processing ? 'Đang xử lý...' : 'Xử lý'}
            </Button>
            <Button
              type="button"
              variant={cameraOpen ? 'default' : 'outline'}
              onClick={cameraOpen ? stopCamera : startCamera}
              title="Mở camera quét QR"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </form>

          {/* Vùng xem trước Camera scanner */}
          {cameraOpen && (
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-black">
              <video ref={videoRef} className="h-56 w-full object-cover" />
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-xs text-white">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  Camera đang quét QR / Mã vạch...
                </span>
                <button type="button" onClick={stopCamera} className="text-slate-400 hover:text-white">
                  Tắt camera
                </button>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Hiển thị kết quả check-in gần nhất */}
          {lastCheckIn && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-1">
              <div className="flex items-center justify-between font-semibold text-sm">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Check-in thành công: Xe {lastCheckIn.carId}
                </span>
                <span className="font-mono text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded">
                  {lastCheckIn.tripId}
                </span>
              </div>
              <p className="mt-1">
                Khu vực phân bổ: <strong className="text-slate-900">{lastCheckIn.zoneName ?? lastCheckIn.zoneId ?? 'Zone nhập'}</strong>
              </p>
              {lastCheckIn.missingSackIds && lastCheckIn.missingSackIds.length > 0 && (
                <p className="text-amber-800">
                  ⚠️ Cảnh báo thiếu bao ({lastCheckIn.missingSackIds.length}): {lastCheckIn.missingSackIds.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Panel chọn / tạo Pallet */}
          {palletLoaded && (
            <PalletPanel
              pallets={pallets}
              zones={zones}
              selectedPalletId={selectedPalletId}
              onSelectPallet={setSelectedPalletId}
              onCreatePallet={handleCreatePallet}
              creating={palletCreating}
            />
          )}

          {/* Lịch sử quét trong phiên */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Lịch sử quét gần đây</p>
            {results.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-lg">
                Chưa có mã nào được quét trong phiên này.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-auto">
                {results.map((res) => (
                  <div
                    key={res.id}
                    className={cn(
                      'flex items-start justify-between rounded-lg border p-2.5 text-xs',
                      res.success ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50',
                    )}
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900">{res.code}</span>
                      <p className="text-slate-600 mt-0.5">{res.message}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                      {res.at.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>
              Đóng
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
