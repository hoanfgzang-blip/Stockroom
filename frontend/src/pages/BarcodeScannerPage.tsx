import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import {
  Barcode, Camera, CheckCircle2, CircleAlert, ClipboardCheck,
  PackageCheck, Plus, Printer, ScanLine, Send, Truck, Undo2,
  ChevronRight, ListChecks, XCircle, RotateCcw, Package,
} from 'lucide-react'
import { BrowserMultiFormatReader, BrowserQRCodeSvgWriter, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import {
  locationsApi, outboundOrdersApi, palletsApi, sacksApi, tripsApi,
  type TripCheckInResult, type TripQrCheckInResult,
} from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Label, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Location, OutboundOrder, Sack, TripQrManifest } from '@/types'
import { useAuth } from '@/auth/AuthContext'

type ScanMode = 'inbound' | 'sorting' | 'outbound' | 'received'
type InboundStep = 'idle' | 'pallet-scan' | 'scanning'
type SackFilter = 'all' | 'scanned' | 'missing' | 'wrong'

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

<<<<<<< HEAD
/* ─── Code-39 barcode helpers ─────────────────────────────────────────────── */
=======
type TripCheckInSession = {
  manifest: TripQrManifest
  arrivedSackIds: string[]
  unexpectedSackIds: string[]
}

const TRIP_QR_PREFIX = 'WMS-TRIP-QR:'
>>>>>>> 652fce01594347f00281419fdec7fdd0a1b5f065

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
  const barcodeSvg = bars.map((bar) => `<rect x="${bar.x}" y="8" width="${bar.width}" height="112" fill="#000" />`).join('')
  const qrSvg = new BrowserQRCodeSvgWriter().write(value, 160, 160).outerHTML
  const printWindow = window.open('', '_blank', 'width=640,height=420')
  if (!printWindow) return
  printWindow.document.write(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Tem ${value}</title>
<style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#111}main{width:88mm;text-align:center;border:1px solid #ddd;padding:8mm}h1{font-size:15pt;margin:0 0 5mm}.codes{display:grid;grid-template-columns:1fr 32mm;align-items:center;gap:5mm}.barcode{width:100%;height:32mm}.qr{width:30mm;height:30mm}.code{font-family:monospace;font-size:13pt;letter-spacing:1.5px;font-weight:700;margin:3mm 0}.note{font-size:9pt;color:#555;margin:0}@page{size:auto;margin:10mm}</style>
</head><body><main><h1>WMS - Tem bao hàng</h1><div class="codes"><div><svg class="barcode" viewBox="0 0 ${width} 128" preserveAspectRatio="none" aria-label="${value}">${barcodeSvg}</svg><p class="code">${value}</p><p class="note">Mã Code 39</p></div><div><div class="qr">${qrSvg}</div><p class="note">QR dự phòng</p></div></div></main><script>window.onload=()=>window.print();</script></body></html>`)
  printWindow.document.close()
}

/* ─── Mode definitions ────────────────────────────────────────────────────── */

const modes: Array<{ id: ScanMode; title: string; description: string; icon: typeof PackageCheck }> = [
<<<<<<< HEAD
  { id: 'inbound', title: 'Xe inbound', description: 'Quét xe → quét pallet → quét từng bao để nhập kho', icon: Truck },
=======
  { id: 'inbound', title: 'Xe inbound', description: 'Quét QR xe, sau đó kiểm đếm từng sack trước khi xác nhận', icon: Truck },
>>>>>>> 652fce01594347f00281419fdec7fdd0a1b5f065
  { id: 'sorting', title: 'Chia chọn', description: 'Xác nhận bao đang được xử lý', icon: ScanLine },
  { id: 'outbound', title: 'Xuất kho', description: 'Giữ bao cho đơn xuất đã chọn', icon: Send },
  { id: 'received', title: 'Nhận hàng', description: 'Xác nhận bao đã đến điểm đích', icon: ClipboardCheck },
]

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    Sorting: 'Đang chia chọn', InTransit: 'Đang vận chuyển', Received: 'Đã nhận',
    Pending: 'Chờ xử lý', Reserved: 'Đã giữ hàng', Completed: 'Hoàn thành',
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

/* ─── Step indicator ──────────────────────────────────────────────────────── */

function InboundStepIndicator({ step }: { step: InboundStep }) {
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
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
            i < currentIndex ? 'bg-emerald-500 text-white' : i === currentIndex ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
          }`}>
            {i < currentIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          <span className={`text-xs font-medium ${i === currentIndex ? 'text-primary' : i < currentIndex ? 'text-emerald-600' : 'text-slate-400'}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <ChevronRight className="mx-1 h-3 w-3 text-slate-300" />}
        </div>
      ))}
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export default function BarcodeScannerPage() {
  const { user } = useAuth()
  const isDriver = user?.roleName === 'Driver'

  // ── Refs
  const inputRef = useRef<HTMLInputElement>(null)
  const palletInputRef = useRef<HTMLInputElement>(null)          // sorting mode
  const inboundPalletRef = useRef<HTMLInputElement>(null)       // inbound pallet-scan step

  // ── General scan state
  const [mode, setMode] = useState<ScanMode>(isDriver ? 'received' : 'inbound')
  const [barcode, setBarcode] = useState('')
  const [sortingPalletId, setSortingPalletId] = useState('')
  const [orders, setOrders] = useState<OutboundOrder[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [outboundOrderId, setOutboundOrderId] = useState('')
  const [lastSack, setLastSack] = useState<Sack | null>(null)
  const [lastTrip, setLastTrip] = useState<InboundCheckInResult | null>(null)
  const [tripSession, setTripSession] = useState<TripCheckInSession | null>(null)
  const [tripConfirming, setTripConfirming] = useState(false)
  const [classification, setClassification] = useState<{ label: string; destinationName?: string | null; zoneName?: string | null } | null>(null)
  const [results, setResults] = useState<ScanResult[]>([])
  const [processing, setProcessing] = useState(false)

  // ── Sack creation dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [destinationId, setDestinationId] = useState('')
  const [creating, setCreating] = useState(false)

  // ── Camera
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)

  // ── Inbound wizard state
  const [inboundStep, setInboundStep] = useState<InboundStep>('idle')
  const [tripManifest, setTripManifest] = useState<TripQrManifest | null>(null)
  const [scannedSackIds, setScannedSackIds] = useState<string[]>([])
  const [wrongSackIds, setWrongSackIds] = useState<string[]>([])
  const [inboundPalletInput, setInboundPalletInput] = useState('')  // input trong step pallet-scan
  const [selectedPalletId, setSelectedPalletId] = useState('')      // pallet đã xác nhận
  const [sackFilter, setSackFilter] = useState<SackFilter>('all')
  const [checkingIn, setCheckingIn] = useState(false)

  /* ─── Camera ─────────────────────────────────────────────────────────── */

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setCameraOpen(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  /* ─── Bootstrap data ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (isDriver) { setOrders([]); setLocations([]); return }
    Promise.allSettled([outboundOrdersApi.all(), locationsApi.all()])
      .then(([o, l]) => {
        setOrders(o.status === 'fulfilled' ? o.value.filter((x) => x.status !== 'Completed') : [])
        setLocations(l.status === 'fulfilled' ? l.value : [])
      })
      .catch(() => { setOrders([]); setLocations([]) })
  }, [isDriver])

  /* ─── Auto-focus ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (mode === 'inbound' && inboundStep === 'pallet-scan') {
      inboundPalletRef.current?.focus()
    } else {
      inputRef.current?.focus()
    }
  }, [mode, inboundStep, processing])

  /* ─── Helpers ────────────────────────────────────────────────────────── */

  const addResult = (sackId: string, message: string, success: boolean) => {
    setResults((current) => [{ id: Date.now(), sackId, message, success, at: new Date() }, ...current].slice(0, 8))
  }

<<<<<<< HEAD
  const resetInboundWizard = () => {
    setInboundStep('idle')
    setTripManifest(null)
    setScannedSackIds([])
    setWrongSackIds([])
    setInboundPalletInput('')
    setSelectedPalletId('')
    setSackFilter('all')
    setBarcode('')
  }

  /* ─── Inbound: xác nhận nhập kho ─────────────────────────────────────── */

  const handleInboundConfirm = async () => {
    if (!tripManifest || checkingIn) return
    setCheckingIn(true)
    try {
      const result = await tripsApi.checkInByQr(tripManifest, scannedSackIds)
      const checkInResult: InboundCheckInResult = {
        tripId: result.tripId, carId: result.carId, status: result.status,
        receivedCount: result.receivedCount, sackCount: result.receivedCount,
        zoneName: result.zoneName, zoneId: result.zoneId,
        missingSackIds: result.missingSackIds, unexpectedSackIds: result.unexpectedSackIds,
      }
      setLastTrip(checkInResult)
      setLastSack(null)
      addResult(result.tripId, formatTripQrResult(checkInResult, tripManifest), result.missingSackIds.length === 0)
      resetInboundWizard()
    } catch (error) {
      addResult(tripManifest.tripId, error instanceof Error ? error.message : 'Không thể xác nhận nhập kho.', false)
    } finally {
      setCheckingIn(false)
    }
  }

  /* ─── Inbound: xác nhận pallet ───────────────────────────────────────── */

  const handlePalletConfirm = (event: FormEvent) => {
    event.preventDefault()
    const palletId = inboundPalletInput.trim()
    setSelectedPalletId(palletId)
    if (palletId) addResult(palletId, `Pallet ${palletId} đã được chọn.`, true)
    setInboundStep('scanning')
  }

  /* ─── Main scan processor ────────────────────────────────────────────── */

=======
  const openTripSession = async (scannedValue: string, legacyManifest?: TripQrManifest) => {
    const manifest = legacyManifest ?? (await tripsApi.resolveQr(scannedValue)).manifest
    setTripSession({ manifest, arrivedSackIds: [], unexpectedSackIds: [] })
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

>>>>>>> 652fce01594347f00281419fdec7fdd0a1b5f065
  const processScan = async (event: FormEvent) => {
    event.preventDefault()
    const scannedCode = barcode.trim()
    if (!scannedCode || processing) return

    setProcessing(true)
    try {
<<<<<<< HEAD
      /* ── INBOUND mode ── */
      if (mode === 'inbound') {
        /* Step 1 — quét xe: nhận manifest */
        if (inboundStep === 'idle') {
          const manifest = parseTripManifest(scannedCode)
          if (!manifest) {
            throw new Error('Mã vừa quét không phải QR manifest hợp lệ. Hãy quét mã QR in trên tờ manifest của xe inbound.')
          }
          setTripManifest(manifest)
          setScannedSackIds([])
          setWrongSackIds([])
          setInboundPalletInput('')
          setSelectedPalletId('')
          setSackFilter('all')
          setInboundStep('pallet-scan')
          addResult(manifest.tripId, `Xe ${manifest.vehicle.id} đã đến. Có ${manifest.sacks.length} bao trong chuyến. Tiếp tục quét pallet.`, true)
          return
        }

        /* Step 3 — quét sack: cập nhật checklist */
        if (inboundStep === 'scanning') {
          if (scannedSackIds.includes(scannedCode)) {
            addResult(scannedCode, 'Bao này đã được quét rồi.', false)
            return
          }
          if (wrongSackIds.includes(scannedCode)) {
            addResult(scannedCode, 'Bao này đã được ghi nhận là không thuộc chuyến.', false)
            return
          }
          const isExpected = tripManifest!.sacks.some((s) => s.sackId === scannedCode)
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
          const remaining = tripManifest!.sacks.length - newScanned.length
          addResult(scannedCode, remaining > 0 ? `Đã nhận bao. Còn ${remaining} bao chưa quét.` : '✅ Đã quét đủ tất cả bao!', true)
          return
        }

        return
      }

      /* ── RECEIVED mode ── */
      if (mode === 'received') {
        const manifest = parseTripManifest(scannedCode)
        if (manifest) {
          const trip: InboundCheckInResult = await tripsApi.checkInByQr(manifest)
          setLastTrip(trip)
          setLastSack(null)
          addResult(trip.tripId, formatTripQrResult(trip, manifest), (trip.missingSackIds?.length ?? 0) === 0)
          return
        }
=======
      if (scannedCode.startsWith(TRIP_QR_PREFIX)) {
        await openTripSession(scannedCode)
        return
      }

      const legacyManifest = parseTripManifest(scannedCode)
      if (legacyManifest) {
        await openTripSession(scannedCode, legacyManifest)
        return
      }

      if (tripSession) {
        recordTripSack(scannedCode)
        return
      }

      if (mode === 'inbound') {
        throw new Error('Hãy quét QR xe để mở phiên đối chiếu trước khi quét sack.')
>>>>>>> 652fce01594347f00281419fdec7fdd0a1b5f065
      }

      /* ── Sack-level modes ── */
      const sack = await sacksApi.get(scannedCode)
      setLastSack(sack)
      setLastTrip(null)

      if (mode === 'sorting') {
        const palletId = sortingPalletId.trim()
        if (!palletId) throw new Error('Quét hoặc nhập mã pallet trước khi quét bao hàng.')
        const result = await palletsApi.assignSack(palletId, sack.sackId)
        setLastSack({ ...sack, palletId: result.palletId ?? palletId, zoneId: result.zoneId ?? null, status: 'Sorted' })
        const label = result.classification === 'IntraProvince' ? 'Hàng nội tỉnh' : result.classification === 'InterProvince' ? 'Hàng liên tỉnh' : 'Đã phân loại'
        setClassification({ label, destinationName: result.destinationName, zoneName: result.zoneName })
        addResult(sack.sackId, `${result.message} Pallet hiện có ${result.assignedSackCount} bao.`, true)
      } else if (mode === 'outbound') {
        if (!outboundOrderId) throw new Error('Chọn đơn xuất trước khi quét bao hàng.')
        await outboundOrdersApi.reserveSack(outboundOrderId, sack.sackId)
        addResult(sack.sackId, 'Đã giữ bao hàng cho đơn xuất.', true)
      } else {
        await sacksApi.confirmReceived(sack.sackId)
        setLastSack({ ...sack, status: 'Received' })
        addResult(sack.sackId, 'Đã xác nhận nhận hàng tại điểm đích.', true)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể xử lý mã vừa quét.'
      if (mode !== 'inbound') setLastSack(null)
      addResult(scannedCode, message, false)
    } finally {
      setBarcode('')
      setProcessing(false)
    }
  }

<<<<<<< HEAD
  const selectedOrder = orders.find((o) => o.outboundOrderId === outboundOrderId)
=======
  const selectedOrder = orders.find((order) => order.outboundOrderId === outboundOrderId)
  const sessionExpectedSackIds = tripSession?.manifest.sacks.map((sack) => sack.sackId) ?? []
  const sessionArrivedSackIds = tripSession?.arrivedSackIds ?? []
  const sessionUnexpectedSackIds = tripSession?.unexpectedSackIds ?? []
  const sessionArrivedSet = new Set(sessionArrivedSackIds.map((id) => id.toLowerCase()))
  const sessionMissingSackIds = sessionExpectedSackIds.filter((id) => !sessionArrivedSet.has(id.toLowerCase()))
>>>>>>> 652fce01594347f00281419fdec7fdd0a1b5f065

  const createSack = async () => {
    if (!destinationId || creating) return
    setCreating(true)
    try {
      const sack = await sacksApi.create({ sDestination: destinationId })
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

  const startCamera = async (target: 'sack' | 'pallet' | 'inbound-pallet' = 'sack') => {
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
          } else if (target === 'inbound-pallet') {
            setInboundPalletInput(scannedValue)
            addResult(scannedValue, 'Đã đọc mã pallet từ camera.', true)
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

  /* ─── Derived values for inbound checklist ───────────────────────────── */

  const expectedSacks = tripManifest?.sacks ?? []
  const scannedCount = scannedSackIds.length
  const totalExpected = expectedSacks.length
  const progressPct = totalExpected > 0 ? Math.round((scannedCount / totalExpected) * 100) : 0
  const allScanned = scannedCount === totalExpected && totalExpected > 0

  const filteredSacks = expectedSacks.filter((s) => {
    if (sackFilter === 'scanned') return scannedSackIds.includes(s.sackId)
    if (sackFilter === 'missing') return !scannedSackIds.includes(s.sackId)
    if (sackFilter === 'wrong') return wrongSackIds.includes(s.sackId)
    return true
  })

  const filterCounts = {
    all: expectedSacks.length + wrongSackIds.length,
    scanned: scannedCount,
    missing: totalExpected - scannedCount,
    wrong: wrongSackIds.length,
  }

  /* ─── Render ─────────────────────────────────────────────────────────── */

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

          {/* ── Mode selector ── */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(isDriver ? modes.filter((m) => m.id === 'received') : modes).map((item) => {
              const Icon = item.icon
              const active = mode === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setMode(item.id); if (item.id === 'inbound') resetInboundWizard() }}
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

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* INBOUND WIZARD                                             */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {mode === 'inbound' && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Nhập kho Inbound
                  </CardTitle>
                  <InboundStepIndicator step={inboundStep} />
                </div>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* ── Bước 1: Quét xe ── */}
                {inboundStep === 'idle' && (
                  <form onSubmit={processScan} className="space-y-4">
                    <div>
                      <Label htmlFor="barcode">Quét xe inbound</Label>
                      <div className="mt-1 flex gap-3">
                        <input
                          ref={inputRef}
                          id="barcode"
                          value={barcode}
                          onChange={(e) => setBarcode(e.target.value)}
                          placeholder="Đưa máy quét vào tem QR trên xe..."
                          autoComplete="off"
                          className="flex h-14 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base outline-none ring-primary focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={processing}
                        />
                        <Button type="button" variant="outline" size="lg" className="h-14 shrink-0 px-4" onClick={() => void startCamera()} title="Quét bằng camera">
                          <Camera className="h-5 w-5" />
                          Camera
                        </Button>
                        <Button type="submit" size="lg" disabled={!barcode.trim() || processing} className="h-14 shrink-0">
                          <ScanLine className="h-5 w-5" />
                          {processing ? 'Đang đọc...' : 'Quét xe'}
                        </Button>
                      </div>
                    </div>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      Quét mã QR trên tờ manifest dán ở xe inbound để nhận danh sách bao hàng của chuyến.
                    </p>
                  </form>
                )}

                {/* ── Bước 2: Quét pallet ── */}
                {inboundStep === 'pallet-scan' && tripManifest && (
                  <div className="space-y-5">
                    {/* Trip summary */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Chuyến xe đã nhận</p>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div>
                          <p className="text-xs text-slate-500">Mã chuyến</p>
                          <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">{tripManifest.tripId}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Xe</p>
                          <p className="mt-0.5 text-sm font-semibold">{tripManifest.vehicle.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Từ</p>
                          <p className="mt-0.5 text-sm font-medium">{tripManifest.origin.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Số bao</p>
                          <p className="mt-0.5 text-sm font-bold text-primary">{tripManifest.sacks.length} bao</p>
                        </div>
                      </div>
                    </div>

                    {/* Pallet scan input */}
                    <form onSubmit={handlePalletConfirm} className="space-y-4">
                      <div>
                        <Label htmlFor="inbound-pallet">Quét pallet</Label>
                        <div className="mt-1 flex gap-3">
                          <input
                            ref={inboundPalletRef}
                            id="inbound-pallet"
                            value={inboundPalletInput}
                            onChange={(e) => setInboundPalletInput(e.target.value)}
                            placeholder="Quét hoặc nhập mã pallet..."
                            autoComplete="off"
                            className="flex h-14 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base outline-none ring-primary focus:ring-2"
                          />
                          <Button type="button" variant="outline" size="lg" className="h-14 shrink-0 px-4" onClick={() => void startCamera('inbound-pallet')} title="Quét pallet bằng camera">
                            <Camera className="h-5 w-5" />
                            Camera
                          </Button>
                          <Button type="submit" size="lg" disabled={!inboundPalletInput.trim()} className="h-14 shrink-0">
                            <ChevronRight className="h-5 w-5" />
                            Tiếp tục
                          </Button>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Quét mã pallet sẽ chứa các bao hàng của chuyến này.
                        </p>
                      </div>

                      <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
                        <Button type="button" variant="ghost" size="sm" onClick={resetInboundWizard}>
                          <RotateCcw className="h-4 w-4" />
                          Quét lại xe
                        </Button>
                        <div className="flex-1" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedPalletId(''); setInboundPalletInput(''); setInboundStep('scanning') }}
                        >
                          Bỏ qua, không dùng pallet
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ── Bước 3: Quét sacks + checklist ── */}
                {inboundStep === 'scanning' && tripManifest && (
                  <div className="space-y-5">
                    {/* Trip + pallet info bar */}
                    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Truck className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="text-slate-500">Xe:</span>
                        <span className="font-mono font-semibold text-slate-800">{tripManifest.vehicle.id}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-slate-600">{tripManifest.tripId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Package className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="text-slate-500">Pallet:</span>
                        {selectedPalletId
                          ? <span className="font-mono font-bold text-primary">{selectedPalletId}</span>
                          : <span className="italic text-slate-400">Không chọn</span>
                        }
                        <button
                          type="button"
                          className="ml-auto text-xs text-slate-400 underline hover:text-slate-600"
                          onClick={() => { setInboundPalletInput(selectedPalletId); setInboundStep('pallet-scan') }}
                        >
                          Đổi
                        </button>
                      </div>
                    </div>
<<<<<<< HEAD

                    {/* Progress bar */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-900">
                          <span className={allScanned ? 'text-emerald-600' : 'text-primary'}>{scannedCount}</span>
                          <span className="text-slate-400"> / {totalExpected} bao đã quét</span>
                        </span>
                        <span className={`text-xs font-bold ${allScanned ? 'text-emerald-600' : 'text-primary'}`}>{progressPct}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${allScanned ? 'bg-emerald-500' : 'bg-primary'}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      {wrongSackIds.length > 0 && (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          ⚠️ {wrongSackIds.length} bao quét không thuộc chuyến này
                        </p>
                      )}
                    </div>

                    {/* Sack scan input */}
                    <form onSubmit={processScan}>
                      <Label htmlFor="sack-barcode">Quét bao hàng (Sack)</Label>
                      <div className="mt-1 flex gap-3">
                        <input
                          ref={inputRef}
                          id="sack-barcode"
                          value={barcode}
                          onChange={(e) => setBarcode(e.target.value)}
                          placeholder="Quét hoặc nhập mã SACK-..."
                          autoComplete="off"
                          className="flex h-14 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base outline-none ring-primary focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={processing}
                        />
                        <Button type="button" variant="outline" size="lg" className="h-14 shrink-0 px-4" onClick={() => void startCamera()} title="Quét bằng camera">
                          <Camera className="h-5 w-5" />
                        </Button>
                        <Button type="submit" size="lg" disabled={!barcode.trim() || processing} className="h-14 shrink-0">
                          <ScanLine className="h-5 w-5" />
                          {processing ? '...' : 'Quét'}
                        </Button>
                      </div>
                    </form>

                    {/* Filter tabs */}
                    <div>
                      <div className="mb-3 flex items-center gap-1 rounded-lg bg-slate-100 p-1">
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
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                              sackFilter === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {tab.label}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              sackFilter === tab.key ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'
                            }`}>
                              {filterCounts[tab.key]}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Sack checklist */}
                      <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                        {sackFilter === 'wrong' && wrongSackIds.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-400">Không có bao ngoài danh sách.</div>
                        ) : sackFilter === 'wrong' ? (
                          wrongSackIds.map((id) => (
                            <div key={id} className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                              <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-mono text-xs font-bold text-red-800">{id}</p>
                                <p className="text-xs text-red-600">Không thuộc chuyến này</p>
                              </div>
                            </div>
                          ))
                        ) : filteredSacks.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-400">Không có bao nào trong bộ lọc này.</div>
                        ) : (
                          filteredSacks.map((sack) => {
                            const isScanned = scannedSackIds.includes(sack.sackId)
                            return (
                              <div
                                key={sack.sackId}
                                className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                                  isScanned ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                                }`}
                              >
                                {isScanned
                                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                  : <div className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" />
                                }
                                <div className="min-w-0 flex-1">
                                  <p className={`truncate font-mono text-xs font-bold ${isScanned ? 'text-emerald-800' : 'text-slate-700'}`}>
                                    {sack.sackId}
                                  </p>
                                  <p className={`text-xs ${isScanned ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {sack.destination}
                                  </p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isScanned ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {isScanned ? 'Đã quét' : 'Chưa quét'}
                                </span>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                      <Button variant="ghost" size="sm" onClick={resetInboundWizard}>
                        Quét xe khác
                      </Button>
                      <div className="flex-1" />
                      <Button
                        onClick={() => void handleInboundConfirm()}
                        disabled={checkingIn || scannedCount === 0}
                        className={allScanned ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        <ListChecks className="h-4 w-4" />
                        {checkingIn
                          ? 'Đang xác nhận...'
                          : allScanned
                            ? 'Xác nhận nhập kho (đủ hàng)'
                            : `Xác nhận nhập kho (${scannedCount}/${totalExpected})`}
=======
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
>>>>>>> 652fce01594347f00281419fdec7fdd0a1b5f065
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

<<<<<<< HEAD
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* OTHER MODES scan card                                      */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {mode !== 'inbound' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Barcode className="h-5 w-5 text-primary" />
                  Phiên quét {modes.find((m) => m.id === mode)?.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={processScan} className="space-y-5">
                  {mode === 'outbound' && (
                    <div>
                      <Label htmlFor="outbound-order">Đơn xuất</Label>
                      <Select id="outbound-order" value={outboundOrderId} onChange={(e) => setOutboundOrderId(e.target.value)} className="mt-1">
                        <option value="">Chọn đơn xuất cần xử lý</option>
                        {orders.map((o) => (
                          <option key={o.outboundOrderId} value={o.outboundOrderId}>
                            {o.outboundOrderNumber} - {o.outboundCustomerName}
                          </option>
                        ))}
                      </Select>
                      {selectedOrder && (
                        <p className="mt-2 text-xs text-slate-500">Điểm đến: <span className="font-medium text-slate-700">{selectedOrder.outboundDestination}</span></p>
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
                          onChange={(e) => setSortingPalletId(e.target.value)}
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
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder="Quét hoặc nhập mã, ví dụ SACK-..."
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
=======
                <div>
                   <Label htmlFor="barcode">{tripSession ? 'Mã sack thực tế' : mode === 'inbound' ? 'Mã QR chuyến xe inbound' : 'Mã bao hàng'}</Label>
                  <div className="mt-1 flex gap-3">
                    <input
                      ref={inputRef}
                      id="barcode"
                      value={barcode}
                      onChange={(event) => setBarcode(event.target.value)}
                       placeholder={tripSession ? 'Quét từng mã SACK-...' : mode === 'inbound' ? 'Quét QR WMS-TRIP-QR:...' : 'Quét hoặc nhập mã, ví dụ SACK-...'}
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
>>>>>>> 652fce01594347f00281419fdec7fdd0a1b5f065
                  </div>

<<<<<<< HEAD
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {mode === 'sorting' ? 'Quét pallet trước, sau đó quét từng bao để đưa vào pallet đó.' : 'Mẹo: cấu hình máy quét gửi phím Enter sau mã để tự động xử lý ngay sau khi quét.'}
                  </p>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Last trip result ── */}
=======
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                   {mode === 'inbound' ? 'Quét QR xe để mở phiên đối chiếu, sau đó quét từng sack. Chưa bấm xác nhận thì server chưa đổi trạng thái.' : mode === 'sorting' ? 'Quét pallet trước, sau đó quét từng bao để đưa vào pallet đó.' : 'Mẹo: cấu hình máy quét gửi phím Enter sau mã để tự động xử lý ngay sau khi quét.'}
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

>>>>>>> 652fce01594347f00281419fdec7fdd0a1b5f065
          {lastTrip && (
            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardHeader><CardTitle className="text-base">Xe inbound vừa vào kho</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div><p className="text-xs text-slate-500">Mã chuyến</p><p className="mt-1 font-mono font-semibold">{lastTrip.tripId}</p></div>
                  <div><p className="text-xs text-slate-500">Xe</p><p className="mt-1 font-medium">{lastTrip.carId}</p></div>
                  <div><p className="text-xs text-slate-500">Bao đã nhận</p><p className="mt-1 font-semibold">{lastTrip.sackCount ?? lastTrip.receivedCount ?? 0} bao</p></div>
                  <div><p className="text-xs text-slate-500">Zone hiện tại</p><p className="mt-1 font-medium">{lastTrip.zoneName ?? lastTrip.zoneId ?? 'Chưa xác định'}</p></div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Last sack result ── */}
          {lastSack && (
            <Card>
              <CardHeader><CardTitle className="text-base">Bao hàng vừa quét</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-5">
                  <div><p className="text-xs text-slate-500">Mã bao</p><p className="mt-1 font-mono font-semibold">{lastSack.sackId}</p></div>
                  <div><p className="text-xs text-slate-500">Trạng thái</p><div className="mt-1"><Badge status={lastSack.status}>{statusLabel(lastSack.status)}</Badge></div></div>
                  <div><p className="text-xs text-slate-500">Điểm đến</p><p className="mt-1 text-sm font-medium">{lastSack.sDestination}</p></div>
                  <div><p className="text-xs text-slate-500">Pallet chứa</p><p className="mt-1 font-mono text-sm font-semibold">{lastSack.palletId ?? 'Chưa gán'}</p></div>
                  <div><p className="text-xs text-slate-500">Khu vực</p><p className="mt-1 font-mono text-sm font-semibold">{lastSack.zoneId ?? 'Chưa gán'}</p></div>
                </div>
                {mode === 'sorting' && lastSack.palletId && (
                  <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                    {sortingPalletId.trim() && sortingPalletId.trim() !== lastSack.palletId && (
                      <Button variant="outline" size="sm" onClick={() => void reassignLastSack()} disabled={processing}>Chuyển sang pallet đang quét</Button>
                    )}
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
              <CardContent><BarcodeLabel value={lastSack.sackId} /></CardContent>
            </Card>
          )}
        </div>

        {/* ── Scan history sidebar ── */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Lịch sử phiên quét
              <Button variant="ghost" size="sm" onClick={() => setResults([])} disabled={results.length === 0} title="Xóa lịch sử">
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
                    {result.success
                      ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-xs font-semibold">{result.sackId}</p>
                        <time className="shrink-0 text-xs text-slate-400">{result.at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time>
                      </div>
                      <p className={`mt-1 text-xs leading-5 ${result.success ? 'text-slate-600' : 'text-red-600'}`}>{result.message}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Create sack dialog ── */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} title="Tạo bao hàng mới" description="Hệ thống tự sinh mã bao hàng. Người dùng chỉ chọn điểm đến.">
        <div className="space-y-5">
          <div>
            <Label htmlFor="destination">Điểm đến</Label>
            <Select id="destination" value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className="mt-1">
              <option value="">Chọn điểm đến</option>
              {locations.map((l) => <option key={l.locationId} value={l.locationId}>{l.locationName}</option>)}
            </Select>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Sau khi tạo, server trả về mã duy nhất dạng <span className="font-mono font-semibold">SACK-...</span> để in thành tem mã vạch.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating}>Hủy</Button>
            <Button onClick={createSack} disabled={!destinationId || creating}>{creating ? 'Đang tạo' : 'Tạo mã tự động'}</Button>
          </div>
        </div>
      </Dialog>

      {/* ── Classification result dialog ── */}
      <Dialog open={classification !== null} onClose={() => setClassification(null)} title={classification?.label ?? 'Kết quả phân loại'} description="Kết quả được xác định từ tỉnh của điểm đến và zone của pallet đã quét.">
        <div className="space-y-3 text-sm text-slate-700">
          <p><span className="font-semibold">Điểm đến:</span> {classification?.destinationName ?? 'Chưa xác định'}</p>
          <p><span className="font-semibold">Zone hiện tại:</span> {classification?.zoneName ?? 'Chưa xác định'}</p>
          <div className="flex justify-end"><Button onClick={() => setClassification(null)}>Tiếp tục quét</Button></div>
        </div>
      </Dialog>

      {/* ── Camera dialog ── */}
      <Dialog open={cameraOpen} onClose={stopCamera} title="Quét mã bằng camera" description="Đưa tem mã vạch vào giữa khung hình. Mã đọc được sẽ tự điền vào ô quét.">
        <div className="space-y-4">
          {cameraError
            ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{cameraError}</p>
            : <div className="overflow-hidden rounded-lg bg-black"><video ref={cameraVideoRef} className="aspect-video w-full object-cover" muted playsInline /></div>
          }
          <div className="flex justify-end"><Button variant="outline" onClick={stopCamera}>Đóng camera</Button></div>
        </div>
      </Dialog>
    </div>
  )
}
