import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { ArrowRight, Barcode, Camera, CheckCircle2, CircleAlert, ClipboardCheck, History, Keyboard, MapPin, Package, Route, ScanLine, Undo2 } from 'lucide-react'
import { locationsApi, palletsApi, sacksApi, type PalletAssignmentResult } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import { zoneProcessRoleLabel } from '@/lib/zoneFlow'
import type { Location, Pallet, Sack } from '@/types'

type CameraTarget = 'pallet' | 'sack'

type ScanHistoryItem = {
  id: number
  code: string
  message: string
  success: boolean
  at: Date
  stage?: string
}

type ClassificationResult = {
  sack: Sack
  assignment: PalletAssignmentResult
}

type SortingStage = {
  round: string
  zoneLabel: string
  description: string
}

type SortingProcessRole = 'LocalSortBuffer' | 'LocalOutbound' | 'InterprovinceOutbound'

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

function getSortingStage(processRole?: string | null): SortingStage {
  if (processRole === 'LocalSortBuffer') {
    return {
      round: 'Phân loại lần 1',
      zoneLabel: 'Zone A',
      description: 'Quét sack sau inbound để xác định location đích hoặc hub next hop.',
    }
  }
  if (processRole === 'LocalOutbound') {
    return {
      round: 'Phân loại lần 2',
      zoneLabel: 'Zone B',
      description: 'Chia hàng nội tỉnh theo điểm phát trước khi xuất kho.',
    }
  }
  if (processRole === 'InterprovinceOutbound') {
    return {
      round: 'Phân loại lần 2',
      zoneLabel: 'Zone C',
      description: 'Khu outbound liên tỉnh, nhận sack đã được phân tuyến từ Zone A.',
    }
  }
  return {
    round: 'Luồng chưa cấu hình',
    zoneLabel: zoneProcessRoleLabel(processRole),
    description: 'Pallet này chưa thuộc Zone A, Zone B hoặc Zone C.',
  }
}

export default function SortingPage() {
  const palletInputRef = useRef<HTMLInputElement>(null)
  const sackInputRef = useRef<HTMLInputElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const [palletCode, setPalletCode] = useState('')
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null)
  const [activeProcessRole, setActiveProcessRole] = useState<SortingProcessRole>('LocalSortBuffer')
  const [destinationId, setDestinationId] = useState('')
  const [destinations, setDestinations] = useState<Location[]>([])
  const [sackCode, setSackCode] = useState('')
  const [processing, setProcessing] = useState(false)
  const [selectingPallet, setSelectingPallet] = useState(false)
  const [palletSelectionError, setPalletSelectionError] = useState('')
  const [palletSelectionNotice, setPalletSelectionNotice] = useState('')
  const [history, setHistory] = useState<ScanHistoryItem[]>([])
  const [lastClassification, setLastClassification] = useState<ClassificationResult | null>(null)
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null)
  const [cameraError, setCameraError] = useState('')
  const activeStage = getSortingStage(activeProcessRole)
  const destinationOptions = activeProcessRole === 'InterprovinceOutbound'
    ? destinations.filter((location) => location.locationType === 'Hub')
    : activeProcessRole === 'LocalOutbound'
      ? destinations.filter((location) => location.locationType !== 'Hub')
      : []

  const addHistory = (code: string, message: string, success: boolean, stage?: string) => {
    setHistory((current) => [
      { id: Date.now() + Math.random(), code, message, success, at: new Date(), stage },
      ...current,
    ].slice(0, 10))
  }

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setCameraTarget(null)
  }, [])

  const selectWorkflow = (processRole: SortingProcessRole) => {
    setActiveProcessRole(processRole)
    setPalletCode('')
    setSelectedPallet(null)
    setDestinationId('')
    setSackCode('')
    setPalletSelectionError('')
    setPalletSelectionNotice('')
    setLastClassification(null)
    setTimeout(() => palletInputRef.current?.focus(), 0)
  }

  useEffect(() => {
    palletInputRef.current?.focus()
    return () => stopCamera()
  }, [stopCamera])

  useEffect(() => {
    locationsApi.dispatchDestinations().then(setDestinations).catch(() => setDestinations([]))
  }, [])

  const selectPalletByCode = async (code: string) => {
    const value = code.trim()
    if (!value || selectingPallet) return

    setSelectingPallet(true)
    setPalletSelectionError('')
    setPalletSelectionNotice('')
    try {
      const pallet = await palletsApi.get(value)
      const stage = getSortingStage(pallet.zone?.processRole)
      if (pallet.zone?.processRole !== activeProcessRole) {
        throw new Error(`${pallet.palletId} thuộc ${stage.zoneLabel}. Hãy chọn trạm ${stage.round} · ${stage.zoneLabel} trước khi kích hoạt pallet.`)
      }
      const isZoneA = pallet.zone?.processRole === 'LocalSortBuffer'
      const palletDestinationId = pallet.destinationLocationId ?? destinationId
      if (!isZoneA && !palletDestinationId)
        throw new Error('Hãy chọn location đích cho pallet trước khi kích hoạt.')
      if (!isZoneA && !pallet.destinationLocationId)
        await palletsApi.setDestination(pallet.palletId, palletDestinationId)

      setPalletCode(pallet.palletId)
      setDestinationId(isZoneA ? '' : palletDestinationId)
      setSelectedPallet({ ...pallet, destinationLocationId: isZoneA ? null : palletDestinationId })
      setLastClassification(null)
      setPalletSelectionNotice(isZoneA
        ? `Quét sack tại Zone A để hệ thống xác định location đích hoặc hub next hop trước khi đưa sang outbound.`
        : stage.zoneLabel === 'Zone C'
        ? `Sack ngoại tỉnh sẽ vào pallet ${pallet.palletId}. Hệ thống tra Routing Rule và chỉ nhận sack có hub next hop ${palletDestinationId}.`
        : `Sack nội tỉnh sẽ được đưa vào pallet ${pallet.palletId} · điểm phát ${palletDestinationId}.`)
      addHistory(pallet.palletId, `Đã chọn ${pallet.palletId}${isZoneA ? ' · khu gom chung' : ` · đích ${palletDestinationId}`} · ${stage.round}.`, true, stage.round)
      setTimeout(() => sackInputRef.current?.focus(), 0)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể kiểm tra pallet.'
      setSelectedPallet(null)
      setPalletSelectionError(message)
      setPalletSelectionNotice('')
      addHistory(value, message, false)
    } finally {
      setSelectingPallet(false)
    }
  }

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
             if (selectedPallet) {
               setSelectedPallet(null)
               setDestinationId('')
             }
             setPalletSelectionError('')
             setPalletSelectionNotice('')
             setLastClassification(null)
             void selectPalletByCode(value)
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

  const selectPallet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await selectPalletByCode(palletCode)
  }

  const processSack = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const sackId = sackCode.trim()
    const palletId = selectedPallet?.palletId ?? ''
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
      addHistory(sack.sackId, `${assignment.message} Pallet hiện có ${assignment.assignedSackCount} bao.`, true, selectedStage.round)
      setSackCode('')
      setTimeout(() => sackInputRef.current?.focus(), 0)
    } catch (error) {
      addHistory(sackId, error instanceof Error ? error.message : 'Không thể phân loại bao hàng.', false, selectedStage.round)
    } finally {
      setProcessing(false)
    }
  }

  const clearSession = () => {
    stopCamera()
    setPalletCode('')
    setSelectedPallet(null)
    setDestinationId('')
    setSackCode('')
    setPalletSelectionError('')
    setPalletSelectionNotice('')
    setLastClassification(null)
    setHistory([])
    setTimeout(() => palletInputRef.current?.focus(), 0)
  }

  const selectedPalletId = selectedPallet?.palletId ?? ''
  const selectedStage = getSortingStage(selectedPallet?.zone?.processRole)
  const hasSelectedPallet = selectedPallet !== null
  const lastStage = getSortingStage(lastClassification?.assignment.processRole)
  const successfulActions = history.filter((item) => item.success).length
  const failedActions = history.length - successfulActions

  return (
    <div>
      <PageHeader
        title="Phân loại hàng"
        description="Zone A xác định tuyến/location; Zone B và Zone C chỉ tiếp nhận hàng đã phân tuyến để outbound."
        action={
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${hasSelectedPallet ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>
            <span className={`h-2 w-2 rounded-full ${hasSelectedPallet ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]' : 'bg-slate-300'}`} />
            {hasSelectedPallet ? `${selectedStage.round} · ${selectedStage.zoneLabel}` : `Trạm chọn: ${activeStage.zoneLabel}`}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-slate-200 shadow-md shadow-slate-200/60">
            <div className="border-b border-blue-100 bg-[radial-gradient(circle_at_top_right,_rgba(96,165,250,0.22),_transparent_42%),linear-gradient(135deg,_#eff6ff,_#ffffff_72%)] px-5 py-5 sm:px-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-blue-200">
                      <Package className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-slate-900">Phiên phân loại hai lần</h2>
                      <p className="mt-0.5 text-sm text-slate-600">Pallet đích xác định chính xác lần phân loại đang thao tác.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-white/80 bg-white/75 px-3 py-2 text-right shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pallet hoạt động</p>
                  <p className={`mt-1 font-mono text-sm font-bold ${hasSelectedPallet ? 'text-primary' : 'text-slate-400'}`}>{selectedPalletId || 'Chưa chọn'}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-slate-900">Chọn trạm phân loại</p><p className="text-xs text-slate-500">Pallet quét sau đó phải thuộc đúng trạm đã chọn.</p></div>
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <button type="button" aria-pressed={activeProcessRole === 'LocalSortBuffer'} onClick={() => selectWorkflow('LocalSortBuffer')} className={`rounded-2xl border p-4 text-left transition-all ${activeProcessRole === 'LocalSortBuffer' ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-200' : 'border-blue-200 bg-white/85 text-slate-900 hover:border-blue-400 hover:bg-blue-50'}`}>
                    <div className="flex items-start justify-between gap-3"><span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${activeProcessRole === 'LocalSortBuffer' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>Trạm 01</span><span className={`text-xs font-semibold ${activeProcessRole === 'LocalSortBuffer' ? 'text-blue-100' : 'text-blue-600'}`}>Lần 1</span></div>
                    <p className="mt-4 text-base font-bold">Zone A · Phân tuyến</p><p className={`mt-1 text-xs leading-5 ${activeProcessRole === 'LocalSortBuffer' ? 'text-blue-100' : 'text-slate-600'}`}>Quét toàn bộ sack sau inbound để xác định location đích hoặc hub next hop.</p>
                    <p className={`mt-4 flex items-center gap-1.5 text-xs font-semibold ${activeProcessRole === 'LocalSortBuffer' ? 'text-white' : 'text-blue-700'}`}>Zone A <ArrowRight className="h-3.5 w-3.5" /> Outbound B / C</p>
                  </button>
                  <button type="button" aria-pressed={activeProcessRole === 'InterprovinceOutbound'} onClick={() => selectWorkflow('InterprovinceOutbound')} className={`rounded-2xl border p-4 text-left transition-all ${activeProcessRole === 'InterprovinceOutbound' ? 'border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-200' : 'border-violet-200 bg-white/85 text-slate-900 hover:border-violet-400 hover:bg-violet-50'}`}>
                    <div className="flex items-start justify-between gap-3"><span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${activeProcessRole === 'InterprovinceOutbound' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'}`}>Trạm 02</span><span className={`text-xs font-semibold ${activeProcessRole === 'InterprovinceOutbound' ? 'text-violet-100' : 'text-violet-600'}`}>Lần 2</span></div>
                    <p className="mt-4 text-base font-bold">Zone C · Outbound liên tỉnh</p><p className={`mt-1 text-xs leading-5 ${activeProcessRole === 'InterprovinceOutbound' ? 'text-violet-100' : 'text-slate-600'}`}>Nhận sack ngoại tỉnh đã có hub next hop từ Zone A để gom outbound.</p>
                    <p className={`mt-4 flex items-center gap-1.5 text-xs font-semibold ${activeProcessRole === 'InterprovinceOutbound' ? 'text-white' : 'text-violet-700'}`}>Zone C <ArrowRight className="h-3.5 w-3.5" /> Xuất kho</p>
                  </button>
                  <button type="button" aria-pressed={activeProcessRole === 'LocalOutbound'} onClick={() => selectWorkflow('LocalOutbound')} className={`rounded-2xl border p-4 text-left transition-all ${activeProcessRole === 'LocalOutbound' ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'border-emerald-200 bg-white/85 text-slate-900 hover:border-emerald-400 hover:bg-emerald-50'}`}>
                    <div className="flex items-start justify-between gap-3"><span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${activeProcessRole === 'LocalOutbound' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>Trạm 03</span><span className={`text-xs font-semibold ${activeProcessRole === 'LocalOutbound' ? 'text-emerald-100' : 'text-emerald-600'}`}>Lần 2</span></div>
                    <p className="mt-4 text-base font-bold">Zone B · Outbound nội tỉnh</p><p className={`mt-1 text-xs leading-5 ${activeProcessRole === 'LocalOutbound' ? 'text-emerald-100' : 'text-slate-600'}`}>Nhận sack nội tỉnh đã có location đích từ Zone A để gom outbound.</p>
                    <p className={`mt-4 flex items-center gap-1.5 text-xs font-semibold ${activeProcessRole === 'LocalOutbound' ? 'text-white' : 'text-emerald-700'}`}>Zone B <ArrowRight className="h-3.5 w-3.5" /> Xuất kho</p>
                  </button>
                </div>
              </div>
              {hasSelectedPallet && <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="font-semibold text-emerald-900">Đang thao tác: {selectedStage.round} · {selectedStage.zoneLabel}</span></div><span className="text-xs text-emerald-800">{selectedPallet?.zone?.zoneName ?? selectedStage.description}</span></div>}
            </div>

            <CardContent className="space-y-4 p-5 pt-5 sm:p-6 sm:pt-6">
              <form onSubmit={(event) => void selectPallet(event)} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">01</span>
                    <div>
                      <Label htmlFor="sorting-pallet" className="text-base font-semibold text-slate-900">Quét pallet {activeStage.zoneLabel}</Label>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{activeStage.round} đang được chọn. Chỉ pallet thuộc {activeStage.zoneLabel} mới được kích hoạt.</p>
                    </div>
                  </div>
                  {hasSelectedPallet && <Badge status="Success">{selectedStage.round} · {selectedStage.zoneLabel}</Badge>}
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <div className="relative min-w-0 flex-1">
                    <Barcode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-500" />
                    <Input
                      ref={palletInputRef}
                      id="sorting-pallet"
                      value={palletCode}
                       onChange={(event) => {
                         setPalletCode(event.target.value)
                         setPalletSelectionError('')
                         setPalletSelectionNotice('')
                          if (selectedPallet) {
                           setSelectedPallet(null)
                           setDestinationId('')
                           setLastClassification(null)
                         }
                      }}
                      placeholder="Quét hoặc nhập mã pallet"
                      autoComplete="off"
                      className="h-14 border-blue-200 bg-white pl-12 font-mono text-base shadow-sm focus:border-primary"
                      disabled={processing || selectingPallet}
                    />
                  </div>
                  <Button type="button" variant="outline" className="h-14 shrink-0 border-blue-200 bg-white px-4 sm:px-5" onClick={() => void startCamera('pallet')} disabled={processing || selectingPallet} title="Quét pallet bằng camera">
                    <Camera className="h-5 w-5" />
                    Camera
                  </Button>
                  <Button type="submit" className="h-14 shrink-0 px-5 shadow-lg shadow-blue-200" disabled={!palletCode.trim() || processing || selectingPallet}>
                    <CheckCircle2 className="h-5 w-5" />
                    {selectingPallet ? 'Đang kiểm tra...' : hasSelectedPallet ? 'Cập nhật pallet' : 'Xác nhận pallet'}
                  </Button>
                </div>
                {activeProcessRole !== 'LocalSortBuffer' && <div className="mt-3">
                  <Label htmlFor="sorting-destination">{activeProcessRole === 'InterprovinceOutbound' ? 'Hub next hop của pallet Zone C' : 'Location đích của pallet nội tỉnh'}</Label>
                  <Select
                    id="sorting-destination"
                    className="mt-1 h-12 bg-white"
                    value={destinationId}
                    onChange={(event) => setDestinationId(event.target.value)}
                    disabled={processing || selectingPallet || hasSelectedPallet}
                  >
                    <option value="">{activeProcessRole === 'InterprovinceOutbound' ? 'Chọn hub next hop' : 'Chọn location đích nội tỉnh'}</option>
                    {destinationOptions.map((location) => (
                      <option key={location.locationId} value={location.locationId}>
                        {location.locationName} · {location.locationId}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-xs text-slate-500">{activeProcessRole === 'InterprovinceOutbound' ? 'Zone C chỉ nhận bao ngoại tỉnh có cùng hub next hop.' : 'Pallet nội tỉnh chỉ nhận bao cùng location đích.'}</p>
                </div>}
                {palletSelectionError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{palletSelectionError}</p>}
              </form>

              {palletSelectionNotice && selectedPallet && (
                <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm shadow-emerald-100">
                  <div className="flex items-start gap-3">
                    <Route className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-emerald-950">Hướng dẫn phân loại</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-900">{palletSelectionNotice}</p>
                      <div className="mt-3 grid gap-2 text-xs text-emerald-800 sm:grid-cols-2">
                        <p><span className="font-semibold">Zone:</span> {selectedPallet.zone?.zoneName ?? selectedStage.zoneLabel}</p>
                        <p><span className="font-semibold">Luồng:</span> {selectedStage.round}</p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-emerald-800">{selectedStage.description} Chỉ quét sack sau khi đã xác nhận đúng pallet.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 px-2" aria-hidden="true">
                <div className="h-px flex-1 bg-slate-200" />
                <ArrowRight className={`h-4 w-4 ${hasSelectedPallet ? 'text-primary' : 'text-slate-300'}`} />
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={processSack} className={`rounded-2xl border p-4 transition-colors sm:p-5 ${hasSelectedPallet ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50/70'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${hasSelectedPallet ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>02</span>
                    <div>
                      <Label htmlFor="sorting-sack" className="text-base font-semibold text-slate-900">{hasSelectedPallet ? `${selectedStage.round} · Quét bao hàng` : 'Quét bao hàng'}</Label>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{hasSelectedPallet ? selectedStage.description : 'Xác nhận pallet ở trên để mở thao tác này.'}</p>
                    </div>
                  </div>
                  {hasSelectedPallet && <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"><ClipboardCheck className="h-3.5 w-3.5" />{selectedStage.zoneLabel} · {selectedPalletId}</span>}
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <div className="relative min-w-0 flex-1">
                    <ScanLine className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${hasSelectedPallet ? 'text-primary' : 'text-slate-400'}`} />
                    <Input
                      ref={sackInputRef}
                      id="sorting-sack"
                      value={sackCode}
                      onChange={(event) => setSackCode(event.target.value)}
                      placeholder={hasSelectedPallet ? 'Quét mã SACK-...' : 'Chọn pallet trước'}
                      autoComplete="off"
                      className="h-14 bg-white pl-12 font-mono text-base shadow-sm"
                      disabled={processing || !hasSelectedPallet}
                    />
                  </div>
                  <Button type="button" variant="outline" className="h-14 shrink-0 px-4 sm:px-5" onClick={() => void startCamera('sack')} disabled={processing || !hasSelectedPallet} title="Quét bao bằng camera">
                    <Camera className="h-5 w-5" />
                    Camera
                  </Button>
                  <Button type="submit" className="h-14 shrink-0 px-5 shadow-lg shadow-blue-200" disabled={!sackCode.trim() || processing || !hasSelectedPallet}>
                    <ScanLine className="h-5 w-5" />
                    {processing ? 'Đang phân loại...' : 'Phân loại'}
                  </Button>
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
                  <Keyboard className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <p>Máy quét USB hoặc Bluetooth có thể gửi phím Enter sau mã để phân loại liên tục, không cần chạm chuột.</p>
                </div>
              </form>
            </CardContent>
          </Card>

          {lastClassification && (
            <Card className="overflow-hidden border-emerald-200 shadow-md shadow-emerald-100">
                <div className="flex flex-col gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white"><CheckCircle2 className="h-5 w-5" /></span><div><CardTitle className="text-base text-emerald-950">Kết quả {lastStage.round.toLowerCase()}</CardTitle><p className="mt-1 text-xs text-emerald-800">Bao vừa quét đã được xác nhận tại {lastStage.zoneLabel}.</p></div></div>
                <Badge status="Success">{lastStage.zoneLabel} · {classificationLabel(lastClassification.assignment)}</Badge>
              </div>
              <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mã bao</p><p className="mt-1.5 truncate font-mono text-sm font-bold text-slate-900">{lastClassification.sack.sackId}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pallet</p><p className="mt-1.5 truncate font-mono text-sm font-bold text-slate-900">{lastClassification.assignment.palletId ?? selectedPalletId}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Zone / lần phân loại</p><p className="mt-1.5 truncate text-sm font-semibold text-slate-900">{lastStage.zoneLabel} · {lastClassification.assignment.zoneName ?? lastClassification.assignment.zoneId ?? 'Chưa xác định'}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bao trên pallet</p><p className="mt-1.5 text-sm font-bold text-slate-900">{lastClassification.assignment.assignedSackCount} bao</p></div>
                </div>
                <div className="mt-4 grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 sm:grid-cols-2">
                  <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><div><p className="text-xs font-semibold text-emerald-900">Điểm đến cuối</p><p className="mt-1 text-sm text-emerald-800">{lastClassification.assignment.destinationName ?? lastClassification.sack.sDestination}</p></div></div>
                  <div className="flex gap-2"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><div><p className="text-xs font-semibold text-emerald-900">Điểm xuất / next hop</p><p className="mt-1 text-sm text-emerald-800">{lastClassification.assignment.nextHopName ?? lastClassification.assignment.nextHopId ?? 'Không có'}</p></div></div>
                </div>
                <p className="mt-4 text-sm leading-6 text-emerald-900">{lastClassification.assignment.message}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit overflow-hidden xl:sticky xl:top-6">
          <div className="border-b bg-slate-900 px-5 py-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><History className="h-4 w-4" /></span><div><CardTitle className="text-base text-white">Lịch sử phân loại</CardTitle><p className="mt-1 text-xs text-slate-300">Theo dõi riêng từng lần phân loại</p></div></div>
              <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={clearSession} disabled={history.length === 0 && !palletCode} title="Xóa phiên phân loại">
                <Undo2 className="h-4 w-4" />
                Xóa
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Thành công</p><p className="mt-1 text-xl font-bold text-white">{successfulActions}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Cần xử lý</p><p className="mt-1 text-xl font-bold text-white">{failedActions}</p></div>
            </div>
          </div>
          <CardContent className="p-0">
            {history.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><ScanLine className="h-6 w-6" /></span>
                <p className="mt-4 text-sm font-medium text-slate-700">Chưa có thao tác nào</p>
                <p className="mt-1 max-w-52 text-xs leading-5 text-slate-500">Chọn pallet rồi quét mã bao để bắt đầu phiên phân loại.</p>
              </div>
            ) : (
              <ol className="max-h-[34rem] divide-y divide-slate-100 overflow-y-auto">
                {history.map((item) => (
                  <li key={item.id} className="flex gap-3 px-5 py-4">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.success ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {item.success ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2"><p className="truncate font-mono text-xs font-bold text-slate-800">{item.code}</p>{item.stage && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{item.stage}</span>}</div>
                        <time className="shrink-0 text-[11px] text-slate-400">{item.at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time>
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
