import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { Camera, CheckCircle2, History, Package, Route, ScanLine, Undo2 } from 'lucide-react'
import { palletsApi, sacksApi, type PalletAssignmentResult, type SortingPalletTarget, type SortingRoutePreview } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'

type HistoryItem = { id: number; code: string; message: string; success: boolean; at: Date }

function routeLabel(processRole?: string | null) {
  return processRole === 'InterprovinceOutbound' ? 'Zone C · Ngoại tỉnh' : 'Zone B · Nội tỉnh'
}

function targetZoneLabel(processRole?: string | null) {
  return processRole === 'InterprovinceOutbound' ? 'Zone C' : 'Zone B'
}

function targetStatus(target: SortingPalletTarget) {
  if (target.status === 'ReadyForOutbound') return 'Đã hoàn tất sorting'
  return `${target.assignedSackCount}/${target.capacity} sack`
}

export default function SortingPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const [targets, setTargets] = useState<SortingPalletTarget[]>([])
  const [sackCode, setSackCode] = useState('')
  const [route, setRoute] = useState<SortingRoutePreview | null>(null)
  const [activePalletId, setActivePalletId] = useState<string | null>(null)
  const [activeTarget, setActiveTarget] = useState<SortingPalletTarget | null>(null)
  const [lastAssignment, setLastAssignment] = useState<PalletAssignmentResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const addHistory = (code: string, message: string, success: boolean) => {
    setHistory((current) => [
      { id: Date.now() + Math.random(), code, message, success, at: new Date() },
      ...current,
    ].slice(0, 12))
  }

  const loadTargets = async () => {
    setLoading(true)
    setError('')
    try {
      const pallets = await palletsApi.ensureZoneASortingTargets()
      const sackCounts = await Promise.all(pallets.map(async (pallet) => [pallet.palletId, (await sacksApi.byPallet(pallet.palletId)).length] as const))
      const countByPallet = new Map(sackCounts)
      setTargets(pallets
        .filter((pallet) => pallet.destinationLocationId && pallet.zone?.processRole === 'LocalSortBuffer')
        .map((pallet) => ({
          palletId: pallet.palletId,
          destinationLocationId: pallet.destinationLocationId!,
          destinationName: pallet.destinationLocation?.locationName ?? pallet.destinationLocationId!,
          status: pallet.status,
          assignedSackCount: countByPallet.get(pallet.palletId) ?? 0,
          capacity: pallet.capacity,
          zoneId: pallet.zoneId,
          zoneName: pallet.zone?.zoneName ?? 'Zone A',
          processRole: pallet.destinationLocation?.locationType === 'Hub' ? 'InterprovinceOutbound' : 'LocalOutbound',
        })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể khởi tạo 6 pallet sorting.')
    } finally {
      setLoading(false)
    }
  }

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setCameraOpen(false)
  }, [])

  useEffect(() => {
    void loadTargets()
    return () => stopCamera()
  }, [stopCamera])

  const localTargets = useMemo(() => targets.filter((target) => target.processRole === 'LocalOutbound'), [targets])
  const remoteTargets = useMemo(() => targets.filter((target) => target.processRole === 'InterprovinceOutbound'), [targets])

  const autoSortSack = async (rawValue: string) => {
    const value = rawValue.trim()
    if (!value || processing) return

    setProcessing(true)
    setError('')
    setNotice('')
    setLastAssignment(null)
    try {
      const result = await sacksApi.autoSort(value)
      const target = result.route.candidatePallets.find((item) => item.palletId === result.assignment.palletId) ?? null
      setRoute(result.route)
      setActivePalletId(result.assignment.palletId ?? null)
      setActiveTarget(target)
      setLastAssignment(result.assignment)
      setNotice(`Hệ thống đã tự gắn ${result.assignment.sackId} vào ${result.assignment.palletId}.`)
      addHistory(value, `Tự động vào ${result.assignment.palletId} · ${result.assignment.nextHopName ?? result.assignment.nextHopId}`, true)
      setSackCode('')
      await loadTargets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tự động sorting sack.'
      setError(message)
      addHistory(value, message, false)
    } finally {
      setProcessing(false)
    }
  }

  const submitAutoSort = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void autoSortSack(sackCode)
  }

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt hoặc thiết bị chưa hỗ trợ camera.')
      setCameraOpen(true)
      return
    }

    stopCamera()
    setCameraError('')
    setCameraOpen(true)
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const video = videoRef.current
      if (!video) throw new Error('Không thể mở vùng xem trước camera.')

      const hints = new Map<DecodeHintType, BarcodeFormat[]>()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39, BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE])
      const reader = new BrowserMultiFormatReader(hints)
      scannerControlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        video,
        (result, _error, controls) => {
          if (!result) return
          const value = result.getText().trim()
          if (!value) return
          controls.stop()
          scannerControlsRef.current = null
          setCameraOpen(false)
          setSackCode(value)
          void autoSortSack(value)
        },
      )
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Không thể truy cập camera.')
    }
  }

  const completeSorting = async () => {
    if (!activePalletId || processing) return
    setProcessing(true)
    setError('')
    try {
      await palletsApi.completeSorting(activePalletId)
      addHistory(activePalletId, 'Nhân viên đã xác nhận pallet sẵn sàng outbound.', true)
      setNotice(`${activePalletId} đã được chuyển sang ${targetZoneLabel(activeTarget?.processRole ?? route?.targetProcessRole)} để xuất kho.`)
      setActivePalletId(null)
      setActiveTarget(null)
      setRoute(null)
      setLastAssignment(null)
      await loadTargets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể hoàn tất sorting pallet.')
    } finally {
      setProcessing(false)
    }
  }

  const clearSession = () => {
    setSackCode('')
    setRoute(null)
    setActivePalletId(null)
    setActiveTarget(null)
    setLastAssignment(null)
    setError('')
    setNotice('')
    setHistory([])
  }

  return (
    <div>
      <PageHeader
        title="Sorting Zone A"
        description="Quét sack, hệ thống tự phân tuyến và gắn vào pallet đúng tuyến. Nhân viên chỉ sắp xếp pallet thực tế rồi xác nhận đưa đi outbound."
        action={<Badge status={targets.length === 6 ? 'Success' : 'Warning'}>{targets.length}/6 pallet đích</Badge>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <div className="border-b border-blue-100 bg-blue-50/70 px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><Package className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Sorting tự động tại Zone A</h2>
                  <p className="mt-1 text-sm text-slate-600">Sack → hệ thống chọn pallet → nhân viên sắp xếp thực tế → outbound.</p>
                </div>
              </div>
            </div>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <form onSubmit={submitAutoSort} className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">01</span>
                  <div><Label htmlFor="sorting-sack" className="text-base font-semibold text-slate-900">Quét sack</Label><p className="mt-1 text-xs leading-5 text-slate-600">Hệ thống tự xác định tuyến, kiểm tra sức chứa và gắn sack vào pallet phù hợp.</p></div>
                </div>
                <div className="mt-4 flex gap-3">
                  <Input id="sorting-sack" value={sackCode} onChange={(event) => setSackCode(event.target.value)} placeholder="Quét hoặc nhập SACK-..." autoComplete="off" disabled={processing} />
                  <Button type="button" variant="outline" onClick={() => void startCamera()} disabled={processing} title="Quét sack bằng camera"><Camera className="h-4 w-4" /> Camera</Button>
                  <Button type="submit" disabled={!sackCode.trim() || processing}><ScanLine className="h-4 w-4" /> Tự động sorting</Button>
                </div>
              </form>

              {route && lastAssignment && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Hệ thống đã phân bổ</p><p className="mt-1 text-lg font-bold text-emerald-950">{routeLabel(route.targetProcessRole)}</p><p className="mt-1 text-sm text-emerald-800">Đích: {route.destinationName} · Next-hop: {route.nextHopName}</p></div>
                    <Route className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-white/75 p-3 text-sm text-emerald-900"><span className="font-semibold">Đã tự đưa vào pallet:</span> <span className="font-mono font-bold">{lastAssignment.palletId}</span> · {lastAssignment.assignedSackCount}/{activeTarget?.capacity ?? 6} sack</div>
                </div>
              )}

              {activePalletId && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm text-amber-900"><span className="font-semibold">Nhân viên sắp xếp thực tế:</span> gom pallet <span className="font-mono font-semibold">{activePalletId}</span>, sau đó xác nhận để chuyển nguyên pallet sang {targetZoneLabel(activeTarget?.processRole ?? route?.targetProcessRole)}.</p>
                  <Button type="button" variant="outline" onClick={() => void completeSorting()} disabled={processing}>Xác nhận sẵn sàng outbound</Button>
                </div>
              )}

              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">Pallet do hệ thống quản lý</CardTitle><p className="mt-1 text-xs text-slate-500">4 tuyến nội tỉnh đến Zone B · 2 tuyến liên tỉnh đến Zone C. Nhân viên không chọn pallet thủ công.</p></div><Button variant="ghost" size="sm" onClick={() => void loadTargets()} disabled={loading}>Làm mới</Button></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...localTargets, ...remoteTargets].map((target) => <div key={target.palletId} className={`rounded-xl border p-3 ${activePalletId === target.palletId ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white'}`}><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-bold text-slate-900">{target.palletId}</span><Badge status={target.processRole === 'InterprovinceOutbound' ? 'Info' : 'Success'}>{targetZoneLabel(target.processRole)}</Badge></div><p className="mt-2 truncate text-xs text-slate-600">{target.destinationName}</p><p className="mt-2 text-xs font-semibold text-slate-500">{targetStatus(target)}</p></div>)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-6">
          <div className="border-b bg-slate-900 px-5 py-5 text-white"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="h-4 w-4" /><CardTitle className="text-base text-white">Lịch sử sorting</CardTitle></div><Button variant="ghost" size="sm" className="text-slate-300" onClick={clearSession}><Undo2 className="h-4 w-4" /> Xóa</Button></div></div>
          <CardContent className="p-0">{history.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">Chưa có thao tác.</p> : <ol className="divide-y divide-slate-100">{history.map((item) => <li key={item.id} className="flex gap-3 px-5 py-4"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.success ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}><CheckCircle2 className="h-4 w-4" /></span><div className="min-w-0"><p className="font-mono text-xs font-bold text-slate-800">{item.code}</p><p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p><time className="mt-1 block text-[11px] text-slate-400">{item.at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div></li>)}</ol>}</CardContent>
        </Card>
      </div>

      <Dialog open={cameraOpen} onClose={stopCamera} title="Quét mã sack" description="Đưa mã vạch vào giữa khung hình. Hệ thống sẽ tự sorting ngay sau khi đọc mã.">
        <div className="space-y-4">
          {cameraError ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{cameraError}</p> : <div className="overflow-hidden rounded-lg bg-black"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /></div>}
          <div className="flex justify-end"><Button variant="outline" onClick={stopCamera}>Đóng camera</Button></div>
        </div>
      </Dialog>
    </div>
  )
}
