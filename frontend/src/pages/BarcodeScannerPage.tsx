// @ts-nocheck
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Barcode, Camera, CheckCircle2, CircleAlert, ClipboardCheck, PackageCheck, Plus, Printer, ScanLine, Send, Truck, Undo2 } from 'lucide-react'
import { BrowserMultiFormatReader, BrowserQRCodeSvgWriter, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { locationsApi, palletsApi, sacksApi, tripsApi, type TripCheckInResult, type TripQrCheckInResult } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Label, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Location, Sack, TripQrManifest } from '@/types'
import { useAuth } from '@/auth/AuthContext'
import { zoneProcessRoleLabel } from '@/lib/zoneFlow'

type ScanMode = 'inbound' | 'sorting' | 'outbound' | 'received'
type ScanResult = {
  id: number
  sackId: string
  message: string
  success: boolean
  at: Date
}

type InboundCheckInResult = Partial<TripCheckInResult> & Partial<TripQrCheckInResult> & {
  tripId: string
  carId: string
  status: string
}

type TripCheckInSession = {
  manifest: TripQrManifest
  arrivedSackIds: string[]
  unexpectedSackIds: string[]
}

type OutboundLoadSession = {
  tripId: string
  qrValue: string
  loadedSackIds: string[]
  expectedSackIds: string[]
  outboundOrderId?: string | null
  outboundOrderNumber?: string | null
  outboundCustomerName?: string | null
  outboundDestination?: string | null
}

const TRIP_QR_PREFIX = 'WMS-TRIP-QR:'

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
  { id: 'inbound', title: 'Xe inbound', description: 'Quét QR xe, sau đó kiểm đếm từng sack trước khi xác nhận', icon: Truck },
  { id: 'sorting', title: 'Chia chọn', description: 'Xác nhận bao đang được xử lý', icon: ScanLine },
  { id: 'outbound', title: 'Xuất kho', description: 'Quét QR xe, chất sack, quét lại QR xe để chốt', icon: Send },
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
    ? `${count} bao da duoc xac nhan nhan tai diem den`
    : `${count} bao duoc dua vao ${trip.zoneName ?? trip.zoneId ?? 'zone nhap'}`
  const suffix = missingCount > 0 ? ` Con thieu ${missingCount} bao: ${trip.missingSackIds?.join(', ')}.` : ' Da den du hang.'
  return `Xe ${trip.carId} da den. ${action}.${suffix}`
}

export default function BarcodeScannerPage() {
  const { user } = useAuth()
  const isDriver = user?.roleName === 'Driver'
  const inputRef = useRef<HTMLInputElement>(null)
  const palletInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ScanMode>(isDriver ? 'received' : 'inbound')
  const [barcode, setBarcode] = useState('')
  const [sortingPalletId, setSortingPalletId] = useState('')
  const [locations, setLocations] = useState<Location[]>([])
  const [lastSack, setLastSack] = useState<Sack | null>(null)
  const [lastTrip, setLastTrip] = useState<InboundCheckInResult | null>(null)
  const [tripSession, setTripSession] = useState<TripCheckInSession | null>(null)
  const [outboundLoadSession, setOutboundLoadSession] = useState<OutboundLoadSession | null>(null)
  const [tripConfirming, setTripConfirming] = useState(false)
  const [classification, setClassification] = useState<{
    label: string
    destinationName?: string | null
    zoneName?: string | null
    processRole?: string | null
    nextHopName?: string | null
  } | null>(null)
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
      setLocations([])
      return
    }
    Promise.allSettled([locationsApi.dispatchDestinations()])
      .then(([warehouseLocationsResult]) => {
        const warehouseLocations = warehouseLocationsResult.status === 'fulfilled' ? warehouseLocationsResult.value : []
        setLocations(warehouseLocations)
      })
      .catch(() => {
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

  const openTripSession = async (scannedValue: string, legacyManifest?: TripQrManifest) => {
    const manifest = legacyManifest ?? (await tripsApi.resolveQr(scannedValue)).manifest
    const previouslyReceivedSackIds = manifest.status === 'CompletedWithMissing'
      ? manifest.sacks.filter((sack) => sack.status !== 'Missing').map((sack) => sack.sackId)
      : []
    setTripSession({ manifest, arrivedSackIds: previouslyReceivedSackIds, unexpectedSackIds: [] })
    setLastTrip(null)
    setLastSack(null)
    addResult(
      manifest.tripId,
      legacyManifest
        ? 'Đã mở phiên từ QR JSON cũ. Hãy quét từng sack thực tế, chưa gọi API nhận hàng.'
        : `Đã mở phiên đối chiếu xe ${manifest.tripId}. Hãy quét từng sack thực tế.`,
      true,
    )
  }

  const openOutboundLoadSession = async (scannedValue: string) => {
    const manifest = (await tripsApi.resolveQr(scannedValue)).manifest
    const loadedSackIds = (manifest.sacks ?? [])
      .map((sack) => typeof sack === 'string' ? sack : sack.sackId)
      .filter(Boolean)
    setOutboundLoadSession({
      tripId: manifest.tripId,
      qrValue: scannedValue,
      loadedSackIds,
      expectedSackIds: manifest.outboundSackIds ?? [],
      outboundOrderId: manifest.outboundOrderId,
      outboundOrderNumber: manifest.outboundOrderNumber,
      outboundCustomerName: manifest.outboundCustomerName,
      outboundDestination: manifest.outboundDestination,
    })
    setTripSession(null)
    setLastTrip(null)
    setLastSack(null)
    addResult(manifest.tripId, 'Đã mở phiên chất hàng bằng QR xe. Hãy quét từng sack, sau đó quét lại QR xe để hoàn tất xuất kho.', true)
  }

  const loadOutboundSack = async (scannedCode: string) => {
    if (!outboundLoadSession) return
    const sack = await sacksApi.get(scannedCode)
    const result = await tripsApi.loadSack(outboundLoadSession.tripId, sack.sackId)
    setLastSack({ ...sack, tripId: outboundLoadSession.tripId, status: 'Loaded' })
    setOutboundLoadSession((current) => current
      ? { ...current, loadedSackIds: [...current.loadedSackIds, sack.sackId] }
      : current)
    addResult(sack.sackId, `Đã chất sack lên xe. Hiện có ${result.loadedCount} sack trên chuyến.`, true)
  }

  const departOutboundByQr = async (scannedValue: string) => {
    if (!outboundLoadSession) return
    const result = await tripsApi.departByQr(outboundLoadSession.tripId, scannedValue)
    setLastTrip({ ...result, sackCount: result.loadedCount })
    setLastSack(null)
    setOutboundLoadSession(null)
    addResult(result.tripId, `Đã quét QR xe lần hai. Xuất kho hoàn tất với ${result.loadedCount} sack; xe đang vận chuyển.`, true)
  }

  const recordTripSack = (scannedSackId: string) => {
    if (!tripSession) return

    const normalizedId = scannedSackId.trim()
    const expectedSack = tripSession.manifest.sacks.find((sack) => sack.sackId.toLowerCase() === normalizedId.toLowerCase())
    if (!expectedSack) {
      setTripSession((current) => current && current.unexpectedSackIds.some((id) => id.toLowerCase() === normalizedId.toLowerCase())
        ? current
        : current ? { ...current, unexpectedSackIds: [...current.unexpectedSackIds, normalizedId] } : current)
      addResult(normalizedId, 'Sack không thuộc chuyến xe này. Không thể chốt phiên.', false)
      return
    }

    if (tripSession.arrivedSackIds.some((id) => id.toLowerCase() === expectedSack.sackId.toLowerCase())) {
      addResult(expectedSack.sackId, 'Sack đã được quét trong phiên này.', false)
      return
    }

    setTripSession((current) => current ? { ...current, arrivedSackIds: [...current.arrivedSackIds, expectedSack.sackId] } : current)
    addResult(expectedSack.sackId, 'Đã ghi nhận sack trong phiên đối chiếu. Chưa cập nhật server.', true)
  }

  const confirmTripSession = async () => {
    if (!tripSession || tripSession.arrivedSackIds.length === 0 || tripSession.unexpectedSackIds.length > 0 || tripConfirming) return

    setTripConfirming(true)
    try {
      const trip = await tripsApi.checkInByQr(tripSession.manifest.tripId, tripSession.arrivedSackIds)
      setLastTrip(trip)
      setLastSack(null)
      addResult(trip.tripId, formatTripQrResult(trip, tripSession.manifest), true)
      setTripSession(null)
    } catch (error) {
      addResult(tripSession.manifest.tripId, error instanceof Error ? error.message : 'Không thể xác nhận nhận hàng.', false)
    } finally {
      setTripConfirming(false)
    }
  }

  const processScan = async (event: FormEvent) => {
    event.preventDefault()
    const scannedCode = barcode.trim()
    if (!scannedCode || processing) return

    setProcessing(true)
    try {
      if (scannedCode.startsWith(TRIP_QR_PREFIX)) {
        if (mode === 'outbound') {
          if (outboundLoadSession) {
            await departOutboundByQr(scannedCode)
          } else {
            await openOutboundLoadSession(scannedCode)
          }
        } else {
          await openTripSession(scannedCode)
        }
        return
      }

      const legacyManifest = parseTripManifest(scannedCode)
      if (legacyManifest) {
        if (mode === 'outbound') {
          throw new Error('Xuất kho cần QR xe dạng WMS-TRIP-QR: mới.')
        }
        await openTripSession(scannedCode, legacyManifest)
        return
      }

      if (outboundLoadSession) {
        await loadOutboundSack(scannedCode)
        return
      }

      if (tripSession) {
        recordTripSack(scannedCode)
        return
      }

      if (mode === 'inbound') {
        throw new Error('Hãy quét QR xe để mở phiên đối chiếu trước khi quét sack.')
      }

      if (mode === 'outbound') {
        throw new Error('Hãy quét QR xe trước, sau đó mới quét sack để chất hàng.')
      }

      const sack = await sacksApi.get(scannedCode)
      setLastSack(sack)
      setLastTrip(null)

      if (mode === 'sorting') {
        const palletId = sortingPalletId.trim()
        if (!palletId) throw new Error('Quét hoặc nhập mã pallet trước khi quét bao hàng.')
        const result = await palletsApi.assignSack(palletId, sack.sackId)
        setLastSack({
          ...sack,
          palletId: result.palletId ?? palletId,
          zoneId: result.zoneId ?? null,
          nextHopId: result.nextHopId ?? null,
          status: 'Sorted',
        })
        const label = result.processRole
          ? `${zoneProcessRoleLabel(result.processRole)} - ${result.classification === 'InterProvince' ? 'hàng ngoại tỉnh' : 'hàng nội tỉnh'}`
          : result.classification === 'IntraProvince' ? 'Hàng nội tỉnh' : result.classification === 'InterProvince' ? 'Hàng liên tỉnh' : 'Đã phân loại'
        setClassification({
          label,
          destinationName: result.destinationName,
          zoneName: result.zoneName,
          processRole: result.processRole,
          nextHopName: result.nextHopName,
        })
        addResult(sack.sackId, `${result.message} Pallet hiện có ${result.assignedSackCount} bao.`, true)
      } else {
        await sacksApi.confirmReceived(sack.sackId)
        setLastSack({ ...sack, status: 'Received' })
        addResult(sack.sackId, 'Đã xác nhận nhận hàng tại điểm đích.', true)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể xử lý mã vừa quét.'
      setLastSack(null)
      addResult(scannedCode, message, false)
    } finally {
      setBarcode('')
      setProcessing(false)
    }
  }

  const sessionExpectedSackIds = tripSession?.manifest.sacks
    .map((sack) => typeof sack === 'string' ? sack : sack.sackId) ?? []
  const sessionArrivedSackIds = tripSession?.arrivedSackIds ?? []
  const sessionUnexpectedSackIds = tripSession?.unexpectedSackIds ?? []
  const sessionArrivedSet = new Set(sessionArrivedSackIds.map((id) => id.toLowerCase()))
  const sessionMissingSackIds = sessionExpectedSackIds.filter((id) => !sessionArrivedSet.has(id.toLowerCase()))

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
      setLastSack({
        ...lastSack,
        palletId: result.palletId ?? palletId,
        zoneId: result.zoneId ?? null,
        nextHopId: result.nextHopId ?? null,
        status: 'Sorted',
      })
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
      setLastSack({ ...lastSack, palletId: null, zoneId: null, nextHopId: null, status: 'Sorting' })
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
        description="Chọn nghiệp vụ, đặt con trỏ vào ô quét và quét QR xe hoặc mã sack theo quy trình. Máy quét USB hoặc Bluetooth hoạt động như bàn phím."
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
                  onClick={() => {
                    setMode(item.id)
                    if (item.id !== 'outbound') setOutboundLoadSession(null)
                    if (item.id !== 'inbound') setTripSession(null)
                  }}
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
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                    <p className="font-semibold">Quy trình xuất kho</p>
                    <p className="mt-1 text-xs leading-5 text-blue-800">
                      1. Quét QR xe để mở chuyến. 2. Quét từng sack để chất lên xe. 3. Quét lại QR xe để hoàn tất xuất kho.
                    </p>
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
                       disabled={processing || tripConfirming}
                      />
                      <Button type="button" variant="outline" className="h-12 shrink-0 px-4" onClick={() => void startCamera('pallet')} title="Quét pallet bằng camera">
                        <Camera className="h-5 w-5" />
                        Quét pallet
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                    <Label htmlFor="barcode">{tripSession ? 'Mã sack thực tế' : mode === 'inbound' ? 'Mã QR chuyến xe inbound' : mode === 'outbound' ? outboundLoadSession ? 'Mã sack hoặc QR xe để chốt' : 'Mã QR xe outbound' : 'Mã bao hàng'}</Label>
                  <div className="mt-1 flex gap-3">
                    <input
                      ref={inputRef}
                      id="barcode"
                      value={barcode}
                      onChange={(event) => setBarcode(event.target.value)}
                        placeholder={tripSession ? 'Quét từng mã SACK-...' : mode === 'inbound' ? 'Quét QR WMS-TRIP-QR:...' : mode === 'outbound' ? outboundLoadSession ? 'Quét mã SACK-... hoặc QR xe' : 'Quét QR WMS-TRIP-QR:...' : 'Quét hoặc nhập mã, ví dụ SACK-...'}
                      autoComplete="off"
                      className="flex h-14 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base outline-none ring-primary focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                       disabled={processing || tripConfirming}
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
                    {mode === 'inbound' ? 'Quét QR xe để mở phiên đối chiếu, sau đó quét từng sack. Chưa bấm xác nhận thì server chưa đổi trạng thái.' : mode === 'outbound' ? 'QR xe lần đầu mở phiên. Mỗi mã sack sẽ được chất lên xe ngay trên server. Quét lại đúng QR xe sau khi đủ hàng để chuyển xe sang đang vận chuyển.' : mode === 'sorting' ? 'Quét pallet trước, sau đó quét từng bao để đưa vào pallet đó.' : 'Mẹo: cấu hình máy quét gửi phím Enter sau mã để tự động xử lý ngay sau khi quét.'}
                </p>
              </form>
            </CardContent>
          </Card>

          {tripSession && (
            <Card className="border-blue-200 bg-blue-50/40">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span>Phiên đối chiếu chuyến xe</span>
                  <Badge status={tripSession.manifest.status}>{tripSession.manifest.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-xs text-slate-500">Mã chuyến</p><p className="mt-1 font-mono font-semibold">{tripSession.manifest.tripId}</p></div>
                  <div><p className="text-xs text-slate-500">Xe / tài xế</p><p className="mt-1 font-medium">{tripSession.manifest.vehicle.id} · {tripSession.manifest.driver.name}</p></div>
                  <div><p className="text-xs text-slate-500">Tuyến</p><p className="mt-1 font-medium">{tripSession.manifest.origin.name} → {tripSession.manifest.destination.name}</p></div>
                  <div><p className="text-xs text-slate-500">Số bao dự kiến</p><p className="mt-1 font-semibold">{sessionExpectedSackIds.length}</p></div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-800">Đã quét ({sessionArrivedSackIds.length})</p>
                    <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                      {sessionArrivedSackIds.map((sackId) => <p key={sackId} className="font-mono text-xs text-emerald-900">{sackId}</p>)}
                      {sessionArrivedSackIds.length === 0 && <p className="text-xs text-emerald-700">Chưa có sack</p>}
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">Còn thiếu ({sessionMissingSackIds.length})</p>
                    <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                      {sessionMissingSackIds.map((sackId) => <p key={sackId} className="font-mono text-xs text-amber-900">{sackId}</p>)}
                      {sessionMissingSackIds.length === 0 && <p className="text-xs text-amber-700">Đã quét đủ</p>}
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs font-semibold text-rose-800">Không thuộc chuyến ({sessionUnexpectedSackIds.length})</p>
                    <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                      {sessionUnexpectedSackIds.map((sackId) => <p key={sackId} className="font-mono text-xs text-rose-900">{sackId}</p>)}
                      {sessionUnexpectedSackIds.length === 0 && <p className="text-xs text-rose-700">Không có</p>}
                    </div>
                  </div>
                </div>

                {sessionUnexpectedSackIds.length > 0 && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Có sack ngoài chuyến. Hãy hủy phiên và quét lại QR xe; không thể xác nhận phiên này.</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setTripSession(null)} disabled={tripConfirming}>Hủy phiên</Button>
                  <Button onClick={() => void confirmTripSession()} disabled={tripConfirming || sessionArrivedSackIds.length === 0 || sessionUnexpectedSackIds.length > 0}>
                    {tripConfirming ? 'Đang xác nhận...' : 'Xác nhận nhập hàng'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {outboundLoadSession && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span>Phiên chất hàng outbound</span>
                  <Badge status="Loading">Đang chất hàng</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><p className="text-xs text-slate-500">Mã chuyến</p><p className="mt-1 font-mono font-semibold">{outboundLoadSession.tripId}</p></div>
                  <div><p className="text-xs text-slate-500">Sack đã chất</p><p className="mt-1 font-semibold">{outboundLoadSession.loadedSackIds.length} sack</p></div>
                </div>
                {outboundLoadSession.outboundOrderNumber && (
                  <div className="grid gap-3 rounded-lg border border-amber-200 bg-white p-3 text-sm sm:grid-cols-2">
                    <div><p className="text-xs text-slate-500">Đơn outbound</p><p className="mt-1 font-mono font-semibold">{outboundLoadSession.outboundOrderNumber}</p></div>
                    <div><p className="text-xs text-slate-500">Điểm đến</p><p className="mt-1 font-medium">{outboundLoadSession.outboundDestination ?? 'Chưa xác định'}</p></div>
                    <div><p className="text-xs text-slate-500">Khách hàng</p><p className="mt-1 font-medium">{outboundLoadSession.outboundCustomerName ?? 'Chưa xác định'}</p></div>
                    <div><p className="text-xs text-slate-500">Sack theo đơn</p><p className="mt-1 font-semibold">{outboundLoadSession.expectedSackIds.length}</p></div>
                  </div>
                )}
                <p className="rounded-lg border border-amber-200 bg-white p-3 text-sm text-amber-900">
                  Đã mở QR xe. Tiếp tục quét từng sack; khi đủ hàng, quét lại đúng QR xe để hoàn tất xuất kho.
                </p>
                {outboundLoadSession.loadedSackIds.length > 0 && (
                  <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-amber-200 bg-white p-3">
                    {outboundLoadSession.loadedSackIds.map((sackId) => <p key={sackId} className="font-mono text-xs text-amber-900">{sackId}</p>)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {lastTrip && (
            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardHeader><CardTitle className="text-base">{lastTrip.status === 'InProgress' ? 'Xe outbound đã xuất kho' : 'Xe inbound vừa vào kho'}</CardTitle></CardHeader>
              <CardContent><div className="grid gap-4 sm:grid-cols-4">
                <div><p className="text-xs text-slate-500">Mã chuyến</p><p className="mt-1 font-mono font-semibold">{lastTrip.tripId}</p></div>
                <div><p className="text-xs text-slate-500">Xe</p><p className="mt-1 font-medium">{lastTrip.carId}</p></div>
                <div><p className="text-xs text-slate-500">Bao đã xử lý</p><p className="mt-1 font-semibold">{lastTrip.sackCount ?? lastTrip.loadedCount ?? lastTrip.receivedCount ?? 0} bao</p></div>
                <div><p className="text-xs text-slate-500">Trạng thái</p><p className="mt-1 font-medium">{lastTrip.status === 'InProgress' ? 'Đang vận chuyển' : lastTrip.zoneName ?? lastTrip.zoneId ?? 'Đã nhận'}</p></div>
              </div></CardContent>
            </Card>
          )}
          {lastSack && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bao hàng vừa quét</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-5">
                <div><p className="text-xs text-slate-500">Mã bao</p><p className="mt-1 font-mono font-semibold">{lastSack.sackId}</p></div>
                <div><p className="text-xs text-slate-500">Trạng thái</p><div className="mt-1"><Badge status={lastSack.status}>{statusLabel(lastSack.status)}</Badge></div></div>
                <div><p className="text-xs text-slate-500">Điểm đến</p><p className="mt-1 text-sm font-medium">{lastSack.sDestination}</p></div>
                <div><p className="text-xs text-slate-500">Pallet chứa</p><p className="mt-1 font-mono text-sm font-semibold">{lastSack.palletId ?? 'Chưa gán'}</p></div><div><p className="text-xs text-slate-500">Khu vực</p><p className="mt-1 font-mono text-sm font-semibold">{lastSack.zoneId ?? 'Chưa gán'}</p></div>
                </div>
                {lastSack.nextHopId && <p className="mt-4 text-sm text-slate-600"><span className="font-semibold">Điểm xuất / next hop:</span> {lastSack.nextHopId}</p>}
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


      <Dialog open={classification !== null} onClose={() => setClassification(null)} title={classification?.label ?? 'Kết quả phân loại'} description="Server xác định lane theo hub hiện tại, điểm đến cuối và rule next hop.">
        <div className="space-y-3 text-sm text-slate-700"><p><span className="font-semibold">Điểm đến cuối:</span> {classification?.destinationName ?? 'Chưa xác định'}</p><p><span className="font-semibold">Zone hiện tại:</span> {classification?.zoneName ?? 'Chưa xác định'}</p>{classification?.nextHopName && <p><span className="font-semibold">Điểm xuất / next hop:</span> {classification.nextHopName}</p>}<div className="flex justify-end"><Button onClick={() => setClassification(null)}>Tiếp tục quét</Button></div></div>
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
