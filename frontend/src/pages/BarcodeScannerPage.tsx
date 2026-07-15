import { FormEvent, useEffect, useRef, useState } from 'react'
import { Barcode, CheckCircle2, CircleAlert, ClipboardCheck, PackageCheck, Plus, ScanLine, Send, Undo2 } from 'lucide-react'
import { locationsApi, outboundOrdersApi, sacksApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Label, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Location, OutboundOrder, Sack } from '@/types'

type ScanMode = 'inbound' | 'sorting' | 'outbound' | 'received'
type ScanResult = {
  id: number
  sackId: string
  message: string
  success: boolean
  at: Date
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ScanMode>('inbound')
  const [barcode, setBarcode] = useState('')
  const [orders, setOrders] = useState<OutboundOrder[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [outboundOrderId, setOutboundOrderId] = useState('')
  const [lastSack, setLastSack] = useState<Sack | null>(null)
  const [results, setResults] = useState<ScanResult[]>([])
  const [processing, setProcessing] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [destinationId, setDestinationId] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([outboundOrdersApi.all(), locationsApi.all()])
      .then(([outboundOrders, warehouseLocations]) => {
        setOrders(outboundOrders.filter((order) => order.status !== 'Completed'))
        setLocations(warehouseLocations)
      })
      .catch(() => {
        setOrders([])
        setLocations([])
      })
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [mode, processing])

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

      if (mode === 'outbound') {
        if (!outboundOrderId) throw new Error('Chọn đơn xuất trước khi quét bao hàng.')
        await outboundOrdersApi.reserveSack(outboundOrderId, sack.sackId)
        addResult(sack.sackId, 'Đã giữ bao hàng cho đơn xuất.', true)
      } else {
        const nextStatus = mode === 'received' ? 'Received' : 'Sorting'
        await sacksApi.updateStatus(sack.sackId, nextStatus)
        setLastSack({ ...sack, status: nextStatus })
        const message = mode === 'received'
          ? 'Đã xác nhận nhận hàng tại điểm đích.'
          : mode === 'sorting'
            ? 'Đã xác nhận bao hàng đang chia chọn.'
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
        sackId: '',
        status: 'Sorting',
        createdAt: new Date().toISOString(),
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

  return (
    <div>
      <PageHeader
        title="Quét mã vạch"
        description="Chọn nghiệp vụ, đặt con trỏ vào ô quét và quét mã bao hàng. Máy quét USB hoặc Bluetooth hoạt động như bàn phím."
        action={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Tạo bao hàng
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {modes.map((item) => {
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
                    <Button type="submit" size="lg" disabled={!barcode.trim() || processing} className="h-14 shrink-0">
                      <ScanLine className="h-5 w-5" />
                      {processing ? 'Đang xử lý' : 'Xử lý'}
                    </Button>
                  </div>
                </div>

                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Mẹo: cấu hình máy quét gửi phím Enter sau mã để tự động xử lý ngay sau khi quét.
                </p>
              </form>
            </CardContent>
          </Card>

          {lastSack && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bao hàng vừa quét</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div><p className="text-xs text-slate-500">Mã bao</p><p className="mt-1 font-mono font-semibold">{lastSack.sackId}</p></div>
                <div><p className="text-xs text-slate-500">Trạng thái</p><div className="mt-1"><Badge status={lastSack.status}>{statusLabel(lastSack.status)}</Badge></div></div>
                <div><p className="text-xs text-slate-500">Điểm đến</p><p className="mt-1 text-sm font-medium">{lastSack.sDestination}</p></div>
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
    </div>
  )
}
