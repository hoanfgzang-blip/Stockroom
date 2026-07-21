import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Barcode, Camera, CheckCircle2, CircleAlert, ClipboardCheck, PackageCheck, Plus, Printer, ScanLine, Send, Undo2 } from 'lucide-react'
import { BrowserMultiFormatReader, BrowserQRCodeSvgWriter, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { locationsApi, outboundOrdersApi, palletsApi, sacksApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Label, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Location, OutboundOrder, Sack } from '@/types'
import { useAuth } from '@/auth/AuthContext'

type ScanMode = 'inbound' | 'sorting' | 'outbound' | 'received'
type ScanResult = {
  id: number
  sackId: string
  message: string
  success: boolean
  at: Date
}

const code39Patterns: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
  F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
  P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
  '$': 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
}

function getCode39Bars(value: string) {
  const characters = `*${value.toUpperCase()}*`
  const bars: Array<{ x: number; width: number }> = []
  let x = 16

  for (const character of characters) {
    const pattern = code39Patterns[character] ?? code39Patterns['-']
    for (let index = 0; index < pattern.length; index += 1) {
      const width = pattern[index] === 'w' ? 6 : 2
      if (index % 2 === 0) bars.push({ x, width })
      x += width + 2
    }
    x += 4
  }

  return { bars, width: x + 16 }
}

function QrCode({ value }: { value: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const svg = new BrowserQRCodeSvgWriter().write(value, 160, 160)
    svg.classList.add('h-full', 'w-full')
    svg.setAttribute('aria-label', `Mã QR ${value}`)
    container.replaceChildren(svg)
  }, [value])

  return <div ref={containerRef} className="aspect-square w-28 shrink-0 bg-white p-1" />
}

function BarcodeLabel({ value }: { value: string }) {
  const { bars, width } = getCode39Bars(value)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
      <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_112px]">
        <div>
          <svg className="h-24 w-full" viewBox={`0 0 ${width} 108`} preserveAspectRatio="none" role="img" aria-label={`Mã vạch ${value}`}>
            <rect width="100%" height="100%" fill="white" />
            {bars.map((bar, index) => <rect key={`${bar.x}-${index}`} x={bar.x} y="4" width={bar.width} height="84" fill="black" />)}
          </svg>
          <p className="mt-2 font-mono text-sm font-semibold tracking-widest text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">Code 39</p>
        </div>
        <div className="justify-self-center">
          <QrCode value={value} />
          <p className="mt-1 text-xs text-slate-500">QR dự phòng</p>
        </div>
      </div>
    </div>
  )
}

function printBarcode(value: string) {
  const { bars, width } = getCode39Bars(value)
  const barcodeSvg = bars
    .map((bar) => `<rect x="${bar.x}" y="8" width="${bar.width}" height="112" fill="#000" />`)
    .join('')
  const qrSvg = new BrowserQRCodeSvgWriter().write(value, 160, 160).outerHTML
  const printWindow = window.open('', '_blank', 'width=640,height=420')

  if (!printWindow) return

  printWindow.document.write(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Tem ${value}</title>
<style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#111}main{width:88mm;text-align:center;border:1px solid #ddd;padding:8mm}h1{font-size:15pt;margin:0 0 5mm}.codes{display:grid;grid-template-columns:1fr 32mm;align-items:center;gap:5mm}.barcode{width:100%;height:32mm}.qr{width:30mm;height:30mm}.code{font-family:monospace;font-size:13pt;letter-spacing:1.5px;font-weight:700;margin:3mm 0}.note{font-size:9pt;color:#555;margin:0}@page{size:auto;margin:10mm}</style>
</head><body><main><h1>WMS - Tem bao hàng</h1><div class="codes"><div><svg class="barcode" viewBox="0 0 ${width} 128" preserveAspectRatio="none" aria-label="${value}">${barcodeSvg}</svg><p class="code">${value}</p><p class="note">Mã Code 39</p></div><div><div class="qr">${qrSvg}</div><p class="note">QR dự phòng</p></div></div></main><script>window.onload=()=>window.print();</script></body></html>`)
  printWindow.document.close()
}

const modes: Array<{ id: ScanMode; title: string; description: string; icon: typeof PackageCheck }> = [
  { id: 'inbound', title: 'Nhập kho', description: 'Ghi nhận bao vào khu chia chọn', icon: PackageCheck },
  { id: 'sorting', title: 'Chia chọn', description: 'Xác nhận bao đang được xử lý', icon: ScanLine },
  { id: 'outbound', title: 'Xuất kho', description: 'Giữ bao cho đơn xuất đã chọn', icon: Send },
  { id: 'received', title: 'Nhận hàng', description: 'Xác nhận bao đã đến điểm đích', icon: ClipboardCheck },
]

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    Sorting: 'Đang chia chọn',
    InTransit: 'Đang vận chuyển',
    Received: 'Đã nhận',
    Pending: 'Chờ xử lý',
    Reserved: 'Đã giữ hàng',
    Completed: 'Hoàn thành',
  }
  return labels[status] ?? status
}

export default function BarcodeScannerPage() {
  const { user } = useAuth()
  const isDriver = user?.roleName === 'Driver'
  const inputRef = useRef<HTMLInputElement>(null)
  const palletInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ScanMode>(isDriver ? 'received' : 'inbound')
  const [barcode, setBarcode] = useState('')
  const [sortingPalletId, setSortingPalletId] = useState('')
  const [orders, setOrders] = useState<OutboundOrder[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [outboundOrderId, setOutboundOrderId] = useState('')
  const [lastSack, setLastSack] = useState<Sack | null>(null)
  const [results, setResults] = useState<ScanResult[]>([])
  const [processing, setProcessing] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [destinationId, setDestinationId] = useState('')
  const [creating, setCreating] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setCameraOpen(false)
  }, [])

  useEffect(() => {
    if (isDriver) {
      setOrders([])
      setLocations([])
      return
    }
    Promise.all([outboundOrdersApi.all(), locationsApi.all()])
      .then(([outboundOrders, warehouseLocations]) => {
        setOrders(outboundOrders.filter((order) => order.status !== 'Completed'))
        setLocations(warehouseLocations)
      })
      .catch(() => {
        setOrders([])
        setLocations([])
      })
  }, [isDriver])

  useEffect(() => {
    inputRef.current?.focus()
  }, [mode, processing])

  useEffect(() => () => stopCamera(), [stopCamera])

  const addResult = (sackId: string, message: string, success: boolean) => {
    setResults((current) => [{ id: Date.now(), sackId, message, success, at: new Date() }, ...current].slice(0, 8))
  }

  const processScan = async (event: FormEvent) => {
    event.preventDefault()
    const sackId = barcode.trim()
    if (!sackId || processing) return

    setProcessing(true)
    try {
      const sack = await sacksApi.get(sackId)
      setLastSack(sack)

      if (mode === 'sorting') {
        const palletId = sortingPalletId.trim()
        if (!palletId) throw new Error('Quét hoặc nhập mã pallet trước khi quét bao hàng.')
        const result = await palletsApi.assignSack(palletId, sack.sackId)
        setLastSack({ ...sack, palletId: result.palletId ?? palletId, zoneId: result.zoneId ?? null, status: 'Sorted' })
        addResult(sack.sackId, `${result.message} Pallet hiện có ${result.assignedSackCount} bao.`, true)
      } else if (mode === 'outbound') {
        if (!outboundOrderId) throw new Error('Chọn đơn xuất trước khi quét bao hàng.')
        await outboundOrdersApi.reserveSack(outboundOrderId, sack.sackId)
        addResult(sack.sackId, 'Đã giữ bao hàng cho đơn xuất.', true)
      } else {
        const nextStatus = mode === 'received' ? 'Received' : 'Sorting'
        await sacksApi.updateStatus(sack.sackId, nextStatus)
        setLastSack({ ...sack, status: nextStatus })
        const message = mode === 'received'
          ? 'Đã xác nhận nhận hàng tại điểm đích.'
          : 'Đã ghi nhận bao hàng vào kho.'
        addResult(sack.sackId, message, true)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể xử lý mã vừa quét.'
      setLastSack(null)
      addResult(sackId, message, false)
    } finally {
      setBarcode('')
      setProcessing(false)
    }
  }

  const selectedOrder = orders.find((order) => order.outboundOrderId === outboundOrderId)

  const createSack = async () => {
    if (!destinationId || creating) return

    setCreating(true)
    try {
      const sack = await sacksApi.create({
        sDestination: destinationId,
      })
      setLastSack(sack)
      setCreateDialogOpen(false)
      setDestinationId('')
      addResult(sack.sackId, 'Đã tạo bao hàng mới. Dùng mã này để in tem và quét.', true)
    } catch (error) {
      addResult('TẠO-BAO', error instanceof Error ? error.message : 'Không thể tạo bao hàng.', false)
    } finally {
      setCreating(false)
    }
  }

  const reassignLastSack = async () => {
    const palletId = sortingPalletId.trim()
    if (!lastSack || !palletId || processing) return

    setProcessing(true)
    try {
      const result = await palletsApi.reassignSack(palletId, lastSack.sackId)
      setLastSack({ ...lastSack, palletId: result.palletId ?? palletId, zoneId: result.zoneId ?? null, status: 'Sorted' })
      addResult(lastSack.sackId, result.message, true)
    } catch (error) {
      addResult(lastSack.sackId, error instanceof Error ? error.message : 'Không thể chuyển bao sang pallet mới.', false)
    } finally {
      setProcessing(false)
    }
  }

  const removeLastSack = async () => {
    if (!lastSack?.palletId || processing) return

    setProcessing(true)
    try {
      const result = await palletsApi.removeSack(lastSack.palletId, lastSack.sackId)
      setLastSack({ ...lastSack, palletId: null, zoneId: null, status: 'Sorting' })
      addResult(lastSack.sackId, result.message, true)
    } catch (error) {
      addResult(lastSack.sackId, error instanceof Error ? error.message : 'Không thể tháo bao khỏi pallet.', false)
    } finally {
      setProcessing(false)
    }
  }

  const startCamera = async (target: 'sack' | 'pallet' = 'sack') => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt hoặc thiết bị này chưa hỗ trợ truy cập camera.')
      setCameraOpen(true)
      return
    }

    stopCamera()
    setCameraError('')
    setCameraOpen(true)

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const video = cameraVideoRef.current
      if (!video) throw new Error('Không thể mở vùng xem trước của camera.')

      const hints = new Map<DecodeHintType, BarcodeFormat[]>()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39, BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE])
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
          if (target === 'pallet') {
            setSortingPalletId(scannedValue)
            addResult(scannedValue, 'Đã chọn pallet phân loại.', true)
          } else {
            setBarcode(scannedValue)
            addResult(scannedValue, 'Đã đọc mã từ camera. Nhấn Xử lý để thực hiện nghiệp vụ đã chọn.', true)
          }
          setCameraOpen(false)
        },
      )
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'Không thể truy cập camera.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Quét mã vạch"
        description="Chọn nghiệp vụ, đặt con trỏ vào ô quét và quét mã bao hàng. Máy quét USB hoặc Bluetooth hoạt động như bàn phím."
        action={!isDriver ? (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Tạo bao hàng
          </Button>
        ) : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(isDriver ? modes.filter((item) => item.id === 'received') : modes).map((item) => {
              const Icon = item.icon
              const active = mode === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`min-h-28 rounded-lg border p-4 text-left transition-colors ${
                    active ? 'border-primary bg-blue-50 ring-2 ring-primary/20' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <Icon className={`mb-3 h-5 w-5 ${active ? 'text-primary' : 'text-slate-500'}`} />
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                </button>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Barcode className="h-5 w-5 text-primary" />
                Phiên quét {modes.find((item) => item.id === mode)?.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={processScan} className="space-y-5">
                {mode === 'outbound' && (
                  <div>
                    <Label htmlFor="outbound-order">Đơn xuất</Label>
                    <Select
                      id="outbound-order"
                      value={outboundOrderId}
                      onChange={(event) => setOutboundOrderId(event.target.value)}
                      className="mt-1"
                    >
                      <option value="">Chọn đơn xuất cần xử lý</option>
                      {orders.map((order) => (
                        <option key={order.outboundOrderId} value={order.outboundOrderId}>
                          {order.outboundOrderNumber} - {order.outboundCustomerName}
                        </option>
                      ))}
                    </Select>
                    {selectedOrder && (
                      <p className="mt-2 text-xs text-slate-500">
                        Điểm đến: <span className="font-medium text-slate-700">{selectedOrder.outboundDestination}</span>
                      </p>
                    )}
                  </div>
                )}

                {mode === 'sorting' && (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="sorting-pallet">Pallet đang phân loại</Label>
                      {sortingPalletId && <span className="font-mono text-xs font-semibold text-primary">{sortingPalletId}</span>}
                    </div>
                    <div className="mt-1 flex gap-3">
                      <input
                        ref={palletInputRef}
                        id="sorting-pallet"
                        value={sortingPalletId}
                        onChange={(event) => setSortingPalletId(event.target.value)}
                        placeholder="Quét hoặc nhập mã pallet"
                        autoComplete="off"
                        className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base outline-none ring-primary focus:ring-2"
                        disabled={processing}
                      />
                      <Button type="button" variant="outline" className="h-12 shrink-0 px-4" onClick={() => void startCamera('pallet')} title="Quét pallet bằng camera">
                        <Camera className="h-5 w-5" />
                        Quét pallet
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="barcode">Mã bao hàng</Label>
                  <div className="mt-1 flex gap-3">
                    <input
                      ref={inputRef}
                      id="barcode"
                      value={barcode}
                      onChange={(event) => setBarcode(event.target.value)}
                      placeholder="Quét hoặc nhập mã, ví dụ DEMO-SACK-001"
                      autoComplete="off"
                      className="flex h-14 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base outline-none ring-primary focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={processing}
                    />
                    <Button type="button" variant="outline" size="lg" className="h-14 shrink-0 px-4" onClick={() => void startCamera()} title="Quét mã bằng camera">
                      <Camera className="h-5 w-5" />
                      Camera
                    </Button>
                    <Button type="submit" size="lg" disabled={!barcode.trim() || processing || (mode === 'sorting' && !sortingPalletId.trim())} className="h-14 shrink-0">
                      <ScanLine className="h-5 w-5" />
                      {processing ? 'Đang xử lý' : 'Xử lý'}
                    </Button>
                  </div>
                </div>

                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  {mode === 'sorting' ? 'Quét pallet trước, sau đó quét từng bao để đưa vào pallet đó.' : 'Mẹo: cấu hình máy quét gửi phím Enter sau mã để tự động xử lý ngay sau khi quét.'}
                </p>
              </form>
            </CardContent>
          </Card>

          {lastSack && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bao hàng vừa quét</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-4">
                <div><p className="text-xs text-slate-500">Mã bao</p><p className="mt-1 font-mono font-semibold">{lastSack.sackId}</p></div>
                <div><p className="text-xs text-slate-500">Trạng thái</p><div className="mt-1"><Badge status={lastSack.status}>{statusLabel(lastSack.status)}</Badge></div></div>
                <div><p className="text-xs text-slate-500">Điểm đến</p><p className="mt-1 text-sm font-medium">{lastSack.sDestination}</p></div>
                <div><p className="text-xs text-slate-500">Pallet</p><p className="mt-1 font-mono text-sm font-semibold">{lastSack.palletId ?? 'Chưa gán'}</p></div>
                </div>
                {mode === 'sorting' && lastSack.palletId && (
                  <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                    {sortingPalletId.trim() && sortingPalletId.trim() !== lastSack.palletId && <Button variant="outline" size="sm" onClick={() => void reassignLastSack()} disabled={processing}>Chuyển sang pallet đang quét</Button>}
                    <Button variant="destructive" size="sm" onClick={() => void removeLastSack()} disabled={processing}>Tháo khỏi pallet</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {lastSack && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Tem mã vạch để in</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => printBarcode(lastSack.sackId)}>
                    <Printer className="h-4 w-4" />
                    In tem
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <BarcodeLabel value={lastSack.sackId} />
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Lịch sử phiên quét
              <Button variant="ghost" size="sm" onClick={() => setResults([])} disabled={results.length === 0} title="Xóa lịch sử phiên quét">
                <Undo2 className="h-4 w-4" />
                Xóa
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">Chưa có mã nào được quét trong phiên này.</div>
            ) : (
              <ol className="space-y-3">
                {results.map((result) => (
                  <li key={result.id} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    {result.success ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3"><p className="font-mono text-xs font-semibold">{result.sackId}</p><time className="shrink-0 text-xs text-slate-400">{result.at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div>
                      <p className={`mt-1 text-xs leading-5 ${result.success ? 'text-slate-600' : 'text-red-600'}`}>{result.message}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title="Tạo bao hàng mới"
        description="Hệ thống tự sinh mã bao hàng. Người dùng chỉ chọn điểm đến."
      >
        <div className="space-y-5">
          <div>
            <Label htmlFor="destination">Điểm đến</Label>
            <Select
              id="destination"
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
              className="mt-1"
            >
              <option value="">Chọn điểm đến</option>
              {locations.map((location) => (
                <option key={location.locationId} value={location.locationId}>
                  {location.locationName}
                </option>
              ))}
            </Select>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Sau khi tạo, server trả về mã duy nhất dạng <span className="font-mono font-semibold">SACK-...</span> để in thành tem mã vạch.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating}>Hủy</Button>
            <Button onClick={createSack} disabled={!destinationId || creating}>
              {creating ? 'Đang tạo' : 'Tạo mã tự động'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={cameraOpen}
        onClose={stopCamera}
        title="Quét mã bằng camera"
        description="Đưa tem mã vạch vào giữa khung hình. Mã đọc được sẽ tự điền vào ô quét."
      >
        <div className="space-y-4">
          {cameraError ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{cameraError}</p>
          ) : (
            <div className="overflow-hidden rounded-lg bg-black">
              <video ref={cameraVideoRef} className="aspect-video w-full object-cover" muted playsInline />
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={stopCamera}>Đóng camera</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
