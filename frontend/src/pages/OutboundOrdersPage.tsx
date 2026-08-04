import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { outboundOrdersApi } from '@/api/services'
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
import type { OutboundOrder, OutboundOrderItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Camera, CircleAlert, QrCode, ScanLine } from 'lucide-react'
import { Input, Label } from '@/components/ui/input'

function extractOutboundCode(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const withoutPrefix = trimmed.replace(/^WMS-OUTBOUND(?:-QR)?:/i, '').trim()

  try {
    const parsed = JSON.parse(withoutPrefix) as Record<string, unknown>
    const code = ['outboundOrderId', 'outboundOrderNumber', 'orderId', 'orderNumber', 'code', 'value']
      .map((key) => parsed[key])
      .find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)

    return code?.trim() ?? withoutPrefix
  } catch {
    return withoutPrefix
  }
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

export default function OutboundOrdersPage() {
  const [orders, setOrders] = useState<OutboundOrder[]>([])
  const [selected, setSelected] = useState<OutboundOrder | null>(null)
  const [items, setItems] = useState<OutboundOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scanProcessing, setScanProcessing] = useState(false)
  const [scanError, setScanError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    outboundOrdersApi
      .all()
      .then(setOrders)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const openDetail = async (order: OutboundOrder) => {
    setSelected(order)
    try {
      const data = await outboundOrdersApi.withItems(order.outboundOrderId)
      setItems(data.items)
    } catch {
      setItems([])
    }
  }

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setCameraOpen(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  useEffect(() => {
    if (qrDialogOpen) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 100)
      return () => window.clearTimeout(timer)
    }

    stopCamera()
  }, [qrDialogOpen, stopCamera])

  const openQrDialog = () => {
    setBarcodeInput('')
    setScanError('')
    setCameraError('')
    setQrDialogOpen(true)
  }

  const closeQrDialog = () => {
    stopCamera()
    setQrDialogOpen(false)
  }

  const processScan = async (rawCode: string) => {
    const code = extractOutboundCode(rawCode)
    if (!code || scanProcessing) return

    setScanProcessing(true)
    setScanError('')

    try {
      let order = orders.find(
        (item) =>
          item.outboundOrderId.toLowerCase() === code.toLowerCase() ||
          item.outboundOrderNumber.toLowerCase() === code.toLowerCase(),
      )

      if (!order) {
        try {
          order = await outboundOrdersApi.get(code)
        } catch {
          throw new Error(`Không tìm thấy đơn outbound với mã: ${code}`)
        }
      }

      if (!orders.some((item) => item.outboundOrderId === order?.outboundOrderId)) {
        setOrders((current) => [order!, ...current])
      }

      await openDetail(order)
      closeQrDialog()
    } catch (scanErrorValue) {
      setScanError(getScanErrorMessage(scanErrorValue))
    } finally {
      setBarcodeInput('')
      setScanProcessing(false)
    }
  }

  const handleProcessScan = async (event: FormEvent) => {
    event.preventDefault()
    await processScan(barcodeInput)
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
          const scannedValue = result.getText().trim()
          if (!scannedValue) return

          controls.stop()
          scannerControlsRef.current = null
          setCameraOpen(false)
          setBarcodeInput(scannedValue)
          void processScan(scannedValue)
        },
      )
    } catch (cameraScanError) {
      setCameraError(getScanErrorMessage(cameraScanError))
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Outbound Orders"
        description="Dispatch orders with inventory reservation linkage."
        action={
          <Button onClick={openQrDialog}>
            <QrCode className="h-4 w-4 mr-1.5" />
            Quét QR Outbound
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Orders ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Điểm đến</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thời điểm tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
            <div>
              <h3 className="mb-3 font-semibold">Reserved Sacks / Items</h3>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">No items linked to this order.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã hàng</TableHead>
                      <TableHead>Mã bao</TableHead>
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

      {/* modal dialog quét qr outbound */}
      <Dialog
        open={qrDialogOpen}
        onClose={closeQrDialog}
        title="Quét QR Outbound"
        description="Quét mã QR để truy xuất thông tin đơn hàng outbound."
        className="max-w-xl"
      >
        <div className="space-y-4">
          <form onSubmit={handleProcessScan} className="space-y-2">
            <Label htmlFor="outbound-qr-code">Mã QR hoặc mã đơn outbound</Label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Input
                  ref={inputRef}
                  id="outbound-qr-code"
                  value={barcodeInput}
                  onChange={(event) => setBarcodeInput(event.target.value)}
                  placeholder="Quét hoặc nhập OUT-... / OUP-..."
                  disabled={scanProcessing}
                  className="pr-9 font-mono"
                  autoComplete="off"
                />
                <ScanLine className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
              </div>
              <Button type="submit" disabled={scanProcessing || !barcodeInput.trim()}>
                {scanProcessing ? 'Đang tra cứu...' : 'Tra cứu'}
              </Button>
              <Button
                type="button"
                variant={cameraOpen ? 'default' : 'outline'}
                onClick={cameraOpen ? stopCamera : () => void startCamera()}
                disabled={scanProcessing}
                title="Mở camera quét QR outbound"
                aria-label="Mở camera quét QR outbound"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-500">QR cần chứa mã đơn hoặc mã ID đơn outbound. Có thể nhập mã trực tiếp nếu không dùng camera.</p>
          </form>

          {cameraOpen && (
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-black">
              <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-xs text-white">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Camera đang quét QR / mã vạch...
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

          {scanError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{scanError}</span>
            </div>
          )}

        </div>
      </Dialog>
    </div>
  )
}
