import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { ArrowRight, Camera, CheckCircle2, ClipboardCheck, History, Package, Route, ScanLine, Undo2 } from 'lucide-react'
import { palletsApi, sacksApi, type PalletAssignmentResult, type SortingPalletTarget, type SortingRoutePreview } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Pallet } from '@/types'

type HistoryItem = { id: number; code: string; message: string; success: boolean; at: Date }
type CameraTarget = 'sack' | 'pallet'

function routeLabel(processRole?: string | null) {
  return processRole === 'InterprovinceOutbound' ? 'Zone C · Ngoại tỉnh' : 'Zone B · Nội tỉnh'
}

function targetZoneLabel(processRole?: string | null) {
  return processRole === 'InterprovinceOutbound' ? 'Zone C' : 'Zone B'
}

function targetStatus(target: SortingPalletTarget) {
  if (target.status === 'ReadyForOutbound') return 'Đã hoàn tất sorting'
  if (target.status === 'Occupied') return `${target.assignedSackCount} sack`
  return 'Trống'
}

export default function SortingPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const [targets, setTargets] = useState<SortingPalletTarget[]>([])
  const [sackCode, setSackCode] = useState('')
  const [palletCode, setPalletCode] = useState('')
  const [route, setRoute] = useState<SortingRoutePreview | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<SortingPalletTarget | null>(null)
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null)
  const [lastAssignment, setLastAssignment] = useState<PalletAssignmentResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null)
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
    setCameraTarget(null)
  }, [])

  useEffect(() => {
    void loadTargets()
    return () => stopCamera()
  }, [stopCamera])

  const localTargets = useMemo(() => targets.filter((target) => target.processRole === 'LocalOutbound'), [targets])
  const remoteTargets = useMemo(() => targets.filter((target) => target.processRole === 'InterprovinceOutbound'), [targets])

  const previewSack = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = sackCode.trim()
    if (!value || processing) return

    setProcessing(true)
    setError('')
    setNotice('')
    setLastAssignment(null)
    try {
      const preview = await sacksApi.previewSortingRoute(value)
      setRoute(preview)
      const matchingCurrent = selectedPallet && selectedPallet.destinationLocationId === preview.nextHopId
        ? selectedTarget
        : null
      const recommendation = matchingCurrent ?? preview.candidatePallets.find((target) => target.palletId === preview.recommendedPalletId) ?? preview.candidatePallets[0] ?? null
      setSelectedTarget(recommendation)
      if (matchingCurrent) {
        setNotice(`Sack này cùng tuyến với pallet ${selectedPallet?.palletId}; có thể gắn ngay.`)
      } else if (recommendation) {
        setNotice(`Tuyến ${routeLabel(preview.targetProcessRole)}. Đưa sack vào pallet ${recommendation.palletId}.`)
        setPalletCode(recommendation.palletId)
      } else {
        setError('Không còn pallet Zone A đang mở cho tuyến này. Hãy hoàn tất/đổi pallet cùng tuyến trước.')
      }
      addHistory(value, `${routeLabel(preview.targetProcessRole)} · ${preview.nextHopName}`, true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể xác định tuyến sack.'
      setRoute(null)
      setSelectedTarget(null)
      setSelectedPallet(null)
      setError(message)
      addHistory(value, message, false)
    } finally {
      setProcessing(false)
    }
  }

  const confirmPallet = async (code: string) => {
    const value = code.trim()
    if (!value || !route || processing) return

    setProcessing(true)
    setError('')
    try {
      const pallet = await palletsApi.get(value)
      if (pallet.zone?.processRole !== 'LocalSortBuffer')
        throw new Error('Pallet xác nhận phải đang ở Zone A.')
      if (pallet.destinationLocationId !== route.nextHopId)
        throw new Error(`Sai pallet. Sack này phải vào pallet có tuyến ${route.nextHopName}.`)
      if (pallet.status === 'ReadyForOutbound' || pallet.status === 'Finalized' || pallet.status === 'Locked')
        throw new Error('Pallet đã hoàn tất sorting hoặc đã khóa.')

      const target = route.candidatePallets.find((item) => item.palletId === pallet.palletId) ?? selectedTarget
      setSelectedPallet(pallet)
      setSelectedTarget(target ?? null)
      setPalletCode(pallet.palletId)
      setNotice(`Đã xác nhận ${pallet.palletId}. Có thể gắn sack ${route.sackId}.`)
      addHistory(pallet.palletId, `Đã xác nhận pallet ${pallet.palletId} cho ${route.nextHopName}.`, true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể xác nhận pallet.'
      setSelectedPallet(null)
      setError(message)
      addHistory(value, message, false)
    } finally {
      setProcessing(false)
    }
  }

  const confirmRecommended = () => {
    if (selectedTarget) void confirmPallet(selectedTarget.palletId)
  }

  const startCamera = async (target: CameraTarget) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt hoặc thiết bị chưa hỗ trợ camera.')
      setCameraTarget(target)
      return
    }

    stopCamera()
    setCameraError('')
    setCameraTarget(target)
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
          setCameraTarget(null)
          if (target === 'sack') {
            setSackCode(value)
            addHistory(value, 'Đã đọc mã sack từ camera. Nhấn Xác định tuyến.', true)
          } else {
            setPalletCode(value)
            if (route) {
              void confirmPallet(value)
            } else {
              setNotice(`Đã đọc mã pallet ${value}. Hãy quét sack trước để hệ thống kiểm tra pallet đúng tuyến.`)
              addHistory(value, 'Đã đọc mã pallet từ camera; đang chờ tuyến của sack.', true)
            }
          }
        },
      )
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Không thể truy cập camera.')
    }
  }

  const assignSack = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!route || !selectedPallet || processing) return

    setProcessing(true)
    setError('')
    try {
      const result = await palletsApi.assignSack(selectedPallet.palletId, route.sackId)
      setLastAssignment(result)
      setNotice(`Đã đưa ${route.sackId} vào ${selectedPallet.palletId}.`)
      addHistory(route.sackId, result.message, true)
      setSackCode('')
      setRoute(null)
      await loadTargets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể đưa sack vào pallet.'
      setError(message)
      addHistory(route.sackId, message, false)
    } finally {
      setProcessing(false)
    }
  }

  const completeSorting = async () => {
    if (!selectedPallet || processing) return
    setProcessing(true)
    setError('')
    try {
      await palletsApi.completeSorting(selectedPallet.palletId)
      addHistory(selectedPallet.palletId, 'Đã hoàn tất sorting, pallet sẵn sàng chuyển sang Zone B/C.', true)
      setNotice(`${selectedPallet.palletId} đã được chuyển sang ${targetZoneLabel(selectedTarget?.processRole)} và sẵn sàng outbound.`)
      setSelectedPallet(null)
      setSelectedTarget(null)
      setRoute(null)
      await loadTargets()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể hoàn tất sorting pallet.'
      setError(message)
    } finally {
      setProcessing(false)
    }
  }

  const clearSession = () => {
    setSackCode('')
    setPalletCode('')
    setRoute(null)
    setSelectedTarget(null)
    setSelectedPallet(null)
    setLastAssignment(null)
    setError('')
    setNotice('')
    setHistory([])
  }

  return (
    <div>
      <PageHeader
        title="Sorting Zone A"
        description="Quét sack trước, hệ thống chỉ pallet đúng tuyến. Đầu ra mỗi hub gồm 4 pallet nội tỉnh cho Zone B và 2 pallet liên tỉnh cho Zone C."
        action={<Badge status={targets.length === 6 ? 'Success' : 'Warning'}>{targets.length}/6 pallet đích</Badge>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <div className="border-b border-blue-100 bg-blue-50/70 px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><Package className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Một công đoạn sorting tại Zone A</h2>
                  <p className="mt-1 text-sm text-slate-600">Sack → xác định tuyến → pallet đích → hoàn tất pallet.</p>
                </div>
              </div>
            </div>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <form onSubmit={(event) => void previewSack(event)} className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">01</span>
                  <div><Label htmlFor="sorting-sack" className="text-base font-semibold text-slate-900">Quét sack trước</Label><p className="mt-1 text-xs leading-5 text-slate-600">Hệ thống tra destination và hiển thị pallet đúng tuyến.</p></div>
                </div>
                <div className="mt-4 flex gap-3">
                  <Input id="sorting-sack" value={sackCode} onChange={(event) => setSackCode(event.target.value)} placeholder="Quét hoặc nhập SACK-..." autoComplete="off" disabled={processing} />
                  <Button type="button" variant="outline" onClick={() => void startCamera('sack')} disabled={processing} title="Quét sack bằng camera"><Camera className="h-4 w-4" /> Camera</Button>
                  <Button type="submit" disabled={!sackCode.trim() || processing}><ScanLine className="h-4 w-4" /> Xác định tuyến</Button>
                </div>
              </form>

              {route && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Tuyến đã xác định</p><p className="mt-1 text-lg font-bold text-emerald-950">{routeLabel(route.targetProcessRole)}</p><p className="mt-1 text-sm text-emerald-800">Đích: {route.destinationName} · Next-hop: {route.nextHopName}</p></div>
                    <Route className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-white/75 p-3 text-sm text-emerald-900"><span className="font-semibold">Pallet cần đưa sack vào:</span> {selectedTarget?.palletId ?? 'Chưa có pallet phù hợp'}</div>
                </div>
              )}

              <form onSubmit={(event) => { event.preventDefault(); void confirmPallet(palletCode) }} className={`rounded-2xl border p-4 sm:p-5 ${route ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${route ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>02</span><div><Label htmlFor="sorting-pallet" className="text-base font-semibold text-slate-900">Xác nhận pallet đích</Label><p className="mt-1 text-xs leading-5 text-slate-600">Quét pallet được hệ thống chỉ định, hoặc dùng pallet đề xuất.</p></div></div>
                <div className="mt-4 flex gap-3"><Input id="sorting-pallet" value={palletCode} onChange={(event) => setPalletCode(event.target.value)} placeholder={route ? 'Quét mã pallet đích' : 'Quét pallet bằng camera'} disabled={!route || processing} autoComplete="off" /><Button type="button" variant="outline" onClick={() => void startCamera('pallet')} disabled={processing} title="Quét pallet bằng camera"><Camera className="h-4 w-4" /> Camera</Button><Button type="submit" variant="outline" disabled={!route || !palletCode.trim() || processing}>Xác nhận pallet</Button></div>
                {route && selectedTarget && <Button type="button" variant="ghost" className="mt-2 text-blue-700" onClick={confirmRecommended} disabled={processing}><CheckCircle2 className="h-4 w-4" /> Dùng pallet đề xuất {selectedTarget.palletId}</Button>}
              </form>

              <form onSubmit={(event) => void assignSack(event)} className={`rounded-2xl border p-4 sm:p-5 ${route && selectedPallet ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${route && selectedPallet ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>03</span><div><Label className="text-base font-semibold text-slate-900">Gắn sack vào pallet</Label><p className="mt-1 text-xs leading-5 text-slate-600">{selectedPallet ? `${route?.sackId} → ${selectedPallet.palletId}` : 'Cần xác nhận đúng pallet trước.'}</p></div></div>
                <div className="mt-4 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700"><ClipboardCheck className="h-4 w-4 text-emerald-600" />{selectedPallet?.palletId ?? 'Chưa chọn pallet'}</span><Button type="submit" disabled={!route || !selectedPallet || processing}><ArrowRight className="h-4 w-4" /> Gắn sack</Button></div>
              </form>

              {selectedPallet && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="text-sm text-amber-900">Pallet {selectedPallet.palletId} đã gom đủ? Hãy khóa đầu ra trước khi chuyển zone.</p><Button type="button" variant="outline" onClick={() => void completeSorting()} disabled={processing}>Hoàn tất sorting pallet</Button></div>}

              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
              {lastAssignment && <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900"><p className="font-semibold">Đã sorting thành công</p><p className="mt-1">{lastAssignment.sackId} → {lastAssignment.palletId} · {lastAssignment.nextHopName ?? lastAssignment.nextHopId}</p></div>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">Đầu ra Zone A</CardTitle><p className="mt-1 text-xs text-slate-500">4 pallet nội tỉnh chuyển Zone B · 2 pallet liên tỉnh chuyển Zone C.</p></div><Button variant="ghost" size="sm" onClick={() => void loadTargets()} disabled={loading}>Làm mới</Button></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...localTargets, ...remoteTargets].map((target) => <button key={target.palletId} type="button" className={`rounded-xl border p-3 text-left ${selectedTarget?.palletId === target.palletId ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white'}`} onClick={() => { setSelectedTarget(target); setPalletCode(target.palletId) }}><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-bold text-slate-900">{target.palletId}</span><Badge status={target.processRole === 'InterprovinceOutbound' ? 'Info' : 'Success'}>{targetZoneLabel(target.processRole)}</Badge></div><p className="mt-2 truncate text-xs text-slate-600">{target.destinationName}</p><p className="mt-2 text-xs font-semibold text-slate-500">{targetStatus(target)}</p></button>)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-6">
          <div className="border-b bg-slate-900 px-5 py-5 text-white"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="h-4 w-4" /><CardTitle className="text-base text-white">Lịch sử sorting</CardTitle></div><Button variant="ghost" size="sm" className="text-slate-300" onClick={clearSession}><Undo2 className="h-4 w-4" /> Xóa</Button></div></div>
          <CardContent className="p-0">{history.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">Chưa có thao tác.</p> : <ol className="divide-y divide-slate-100">{history.map((item) => <li key={item.id} className="flex gap-3 px-5 py-4"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.success ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}><CheckCircle2 className="h-4 w-4" /></span><div className="min-w-0"><p className="font-mono text-xs font-bold text-slate-800">{item.code}</p><p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p><time className="mt-1 block text-[11px] text-slate-400">{item.at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div></li>)}</ol>}</CardContent>
        </Card>
      </div>

      <Dialog open={cameraTarget !== null} onClose={stopCamera} title={cameraTarget === 'sack' ? 'Quét mã sack' : 'Quét mã pallet'} description="Đưa mã vạch vào giữa khung hình để đọc tự động.">
        <div className="space-y-4">
          {cameraError ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{cameraError}</p> : <div className="overflow-hidden rounded-lg bg-black"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /></div>}
          <div className="flex justify-end"><Button variant="outline" onClick={stopCamera}>Đóng camera</Button></div>
        </div>
      </Dialog>
    </div>
  )
}
