import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { Camera, CheckCircle2, CircleAlert, PackageCheck, ScanLine, Undo2 } from 'lucide-react'
import { palletsApi, sacksApi, type PalletAssignmentResult } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import { zoneProcessRoleLabel } from '@/lib/zoneFlow'
import type { Sack } from '@/types'

type CameraTarget = 'pallet' | 'sack'

type ScanHistoryItem = {
  id: number
  code: string
  message: string
  success: boolean
  at: Date
}

type ClassificationResult = {
  sack: Sack
  assignment: PalletAssignmentResult
}

function classificationLabel(assignment: PalletAssignmentResult) {
  const typeLabel = assignment.classification === 'IntraProvince'
    ? 'Hàng nội tỉnh'
    : assignment.classification === 'InterProvince'
      ? 'Hàng liên tỉnh'
      : 'Đã phân loại'

  return assignment.processRole
    ? `${zoneProcessRoleLabel(assignment.processRole)} · ${typeLabel}`
    : typeLabel
}

export default function SortingPage() {
  const palletInputRef = useRef<HTMLInputElement>(null)
  const sackInputRef = useRef<HTMLInputElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const [palletCode, setPalletCode] = useState('')
  const [sackCode, setSackCode] = useState('')
  const [processing, setProcessing] = useState(false)
  const [history, setHistory] = useState<ScanHistoryItem[]>([])
  const [lastClassification, setLastClassification] = useState<ClassificationResult | null>(null)
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null)
  const [cameraError, setCameraError] = useState('')

  const addHistory = (code: string, message: string, success: boolean) => {
    setHistory((current) => [
      { id: Date.now() + Math.random(), code, message, success, at: new Date() },
      ...current,
    ].slice(0, 10))
  }

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setCameraTarget(null)
  }, [])

  useEffect(() => {
    palletInputRef.current?.focus()
    return () => stopCamera()
  }, [stopCamera])

  const startCamera = async (target: CameraTarget) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt hoặc thiết bị này chưa hỗ trợ truy cập camera.')
      setCameraTarget(target)
      return
    }

    stopCamera()
    setCameraError('')
    setCameraTarget(target)

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
          const value = result.getText().trim()
          if (!value) return

          controls.stop()
          scannerControlsRef.current = null
          setCameraTarget(null)
          if (target === 'pallet') {
            setPalletCode(value)
            addHistory(value, 'Đã đọc mã pallet từ camera. Nhấn Chọn pallet để bắt đầu.', true)
          } else {
            setSackCode(value)
            addHistory(value, 'Đã đọc mã bao từ camera. Nhấn Phân loại để xử lý.', true)
          }
        },
      )
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'Không thể truy cập camera.')
    }
  }

  const selectPallet = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = palletCode.trim()
    if (!value) return

    setPalletCode(value)
    setLastClassification(null)
    addHistory(value, 'Đã chọn pallet phân loại. Có thể quét mã bao.', true)
    setTimeout(() => sackInputRef.current?.focus(), 0)
  }

  const processSack = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const sackId = sackCode.trim()
    const palletId = palletCode.trim()
    if (!sackId || processing) return

    if (!palletId) {
      addHistory(sackId, 'Hãy quét hoặc nhập mã pallet trước.', false)
      palletInputRef.current?.focus()
      return
    }

    setProcessing(true)
    try {
      const sack = await sacksApi.get(sackId)
      const assignment = await palletsApi.assignSack(palletId, sack.sackId)
      setLastClassification({
        sack: {
          ...sack,
          palletId: assignment.palletId ?? palletId,
          zoneId: assignment.zoneId ?? sack.zoneId,
          nextHopId: assignment.nextHopId ?? sack.nextHopId,
          status: 'Sorted',
        },
        assignment,
      })
      addHistory(sack.sackId, `${assignment.message} Pallet hiện có ${assignment.assignedSackCount} bao.`, true)
      setSackCode('')
      setTimeout(() => sackInputRef.current?.focus(), 0)
    } catch (error) {
      addHistory(sackId, error instanceof Error ? error.message : 'Không thể phân loại bao hàng.', false)
    } finally {
      setProcessing(false)
    }
  }

  const clearSession = () => {
    stopCamera()
    setPalletCode('')
    setSackCode('')
    setLastClassification(null)
    setHistory([])
    setTimeout(() => palletInputRef.current?.focus(), 0)
  }

  return (
    <div>
      <PageHeader
        title="Phân loại hàng"
        description="Quét mã pallet và mã bao hàng để đưa bao vào đúng khu vực phân loại."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-primary" />
                Phiên phân loại
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={selectPallet} className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="sorting-pallet">Bước 1 · Mã pallet</Label>
                  {palletCode && <Badge status="Active">Đã chọn</Badge>}
                </div>
                <div className="mt-2 flex gap-3">
                  <Input
                    ref={palletInputRef}
                    id="sorting-pallet"
                    value={palletCode}
                    onChange={(event) => setPalletCode(event.target.value)}
                    placeholder="Quét hoặc nhập mã pallet"
                    autoComplete="off"
                    className="h-12 font-mono text-base"
                    disabled={processing}
                  />
                  <Button type="button" variant="outline" className="h-12 shrink-0 px-4" onClick={() => void startCamera('pallet')} disabled={processing} title="Quét pallet bằng camera">
                    <Camera className="h-5 w-5" />
                    Camera
                  </Button>
                  <Button type="submit" className="h-12 shrink-0" disabled={!palletCode.trim() || processing}>
                    Chọn pallet
                  </Button>
                </div>
              </form>

              <form onSubmit={processSack} className="rounded-xl border border-slate-200 bg-white p-4">
                <Label htmlFor="sorting-sack">Bước 2 · Mã bao hàng</Label>
                <div className="mt-2 flex gap-3">
                  <Input
                    ref={sackInputRef}
                    id="sorting-sack"
                    value={sackCode}
                    onChange={(event) => setSackCode(event.target.value)}
                    placeholder={palletCode ? 'Quét mã SACK-...' : 'Chọn pallet trước'}
                    autoComplete="off"
                    className="h-12 font-mono text-base"
                    disabled={processing || !palletCode}
                  />
                  <Button type="button" variant="outline" className="h-12 shrink-0 px-4" onClick={() => void startCamera('sack')} disabled={processing || !palletCode} title="Quét bao bằng camera">
                    <Camera className="h-5 w-5" />
                    Camera
                  </Button>
                  <Button type="submit" className="h-12 shrink-0" disabled={!sackCode.trim() || processing || !palletCode}>
                    <ScanLine className="h-5 w-5" />
                    {processing ? 'Đang xử lý' : 'Phân loại'}
                  </Button>
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Máy quét USB hoặc Bluetooth có thể nhập mã và gửi phím Enter để xử lý nhanh.
                </p>
              </form>
            </CardContent>
          </Card>

          {lastClassification && (
            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Kết quả phân loại
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-500">Mã bao</p>
                    <p className="mt-1 font-mono text-sm font-semibold">{lastClassification.sack.sackId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Phân loại</p>
                    <div className="mt-1"><Badge status="Success">{classificationLabel(lastClassification.assignment)}</Badge></div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Pallet</p>
                    <p className="mt-1 font-mono text-sm font-semibold">{lastClassification.assignment.palletId ?? palletCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Zone</p>
                    <p className="mt-1 text-sm font-medium">{lastClassification.assignment.zoneName ?? lastClassification.assignment.zoneId ?? 'Chưa xác định'}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <p><span className="font-semibold">Điểm đến:</span> {lastClassification.assignment.destinationName ?? lastClassification.sack.sDestination}</p>
                  <p><span className="font-semibold">Next hop:</span> {lastClassification.assignment.nextHopName ?? lastClassification.assignment.nextHopId ?? 'Không có'}</p>
                </div>
                <p className="mt-4 border-t border-emerald-200 pt-3 text-sm text-emerald-800">{lastClassification.assignment.message}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              Lịch sử quét
              <Button variant="ghost" size="sm" onClick={clearSession} disabled={history.length === 0 && !palletCode} title="Xóa phiên phân loại">
                <Undo2 className="h-4 w-4" />
                Xóa
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">Chưa có mã nào được quét.</div>
            ) : (
              <ol className="space-y-3">
                {history.map((item) => (
                  <li key={item.id} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    {item.success ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-mono text-xs font-semibold">{item.code}</p>
                        <time className="shrink-0 text-xs text-slate-400">{item.at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time>
                      </div>
                      <p className={`mt-1 text-xs leading-5 ${item.success ? 'text-slate-600' : 'text-red-600'}`}>{item.message}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={cameraTarget !== null}
        onClose={stopCamera}
        title={cameraTarget === 'pallet' ? 'Quét mã pallet' : 'Quét mã bao hàng'}
        description="Đưa mã vạch vào giữa khung hình để đọc tự động."
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
