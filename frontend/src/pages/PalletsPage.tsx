import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeSvgWriter } from '@zxing/browser'
import { CheckCircle2, Eye, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react'
import { outboundOrdersApi, palletsApi, sacksApi, zonesApi } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
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
import { statusLabel } from '@/lib/utils'
import { isDispatchProcessRole, zoneProcessRoleLabel } from '@/lib/zoneFlow'
import type { OutboundOrder, Pallet, Sack, Zone } from '@/types'

const statusOptions = ['Empty', 'Occupied', 'ReadyForOutbound', 'In Transit to Zone', 'Finalized', 'Locked']

const emptyForm = () => ({
  zoneId: '',
  capacity: '6',
})

function PalletQrCode({ value }: { value: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const svg = new BrowserQRCodeSvgWriter().write(value, 240, 240)
    svg.classList.add('h-full', 'w-full')
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', `Mã QR chứa ${value}`)
    container.replaceChildren(svg)

    return () => container.replaceChildren()
  }, [value])

  return <div ref={containerRef} className="aspect-square w-56 max-w-full rounded-lg border border-slate-200 bg-white p-2" />
}

export default function PalletsPage() {
  const [pallets, setPallets] = useState<Pallet[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [zoneFilter, setZoneFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [detailPallet, setDetailPallet] = useState<Pallet | null>(null)
  const [detailSacks, setDetailSacks] = useState<Sack[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [finalizeTarget, setFinalizeTarget] = useState<Pallet | null>(null)
  const [outboundOrders, setOutboundOrders] = useState<OutboundOrder[]>([])
  const [selectedOutboundOrderId, setSelectedOutboundOrderId] = useState('')
  const [outboundLoading, setOutboundLoading] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [finalizeDestination, setFinalizeDestination] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([palletsApi.all(statusFilter || undefined), zonesApi.all()])
      .then(([palletData, zoneData]) => {
        setZones(zoneData)
        const operationalZoneIds = new Set(zoneData.map((zone) => zone.zoneId))
        setPallets(palletData.filter((pallet) => operationalZoneIds.has(pallet.zoneId)))
        if (!form.zoneId) {
          setForm((current) => ({
            ...current,
            zoneId: current.zoneId || zoneData[0]?.zoneId || '',
          }))
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  const zoneName = (id: string) => zones.find((z) => z.zoneId === id)?.zoneName ?? id
  const zoneRole = (pallet: Pallet) => pallet.zone?.processRole ?? zones.find((zone) => zone.zoneId === pallet.zoneId)?.processRole

  const filteredPallets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return pallets.filter((pallet) => {
      const matchesZone = !zoneFilter || pallet.zoneId === zoneFilter
      const matchesSearch = !query || pallet.palletId.toLowerCase().includes(query) || zoneName(pallet.zoneId).toLowerCase().includes(query)
      return matchesZone && matchesSearch
    })
  }, [pallets, search, zoneFilter, zones])

  const stats = useMemo(() => ({
    total: pallets.length,
    empty: pallets.filter((p) => p.status === 'Empty').length,
    occupied: pallets.filter((p) => p.status === 'Occupied').length,
    finalized: pallets.filter((p) => p.status === 'Finalized').length,
  }), [pallets])

  const openCreate = () => {
    setForm({ ...emptyForm(), zoneId: zones[0]?.zoneId ?? '' })
    setDialogOpen(true)
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.zoneId) {
      setError('Hãy chọn khu vực đặt pallet.')
      return
    }
    const capacity = Number(form.capacity)
    if (!Number.isFinite(capacity) || capacity <= 0 || capacity > 6) {
      setError('Pallet chỉ được chứa tối đa 6 sack.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const created = await palletsApi.create({ zoneId: form.zoneId, destinationLocationId: null, capacity })
      setDialogOpen(false)
      setNotice(`Đã tạo pallet ${created.palletId}. Hệ thống đặt trạng thái ban đầu là trống.`)
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const deletePallet = async (pallet: Pallet) => {
    if (!window.confirm(`Xóa pallet ${pallet.palletId}?`)) return
    setSaving(true)
    setError(null)
    try {
      await palletsApi.delete(pallet.palletId)
      setNotice('Đã xóa pallet.')
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const openDetails = async (pallet: Pallet) => {
    setDetailPallet(pallet)
    setDetailSacks([])
    setDetailError(null)
    setDetailLoading(true)

    try {
      setDetailSacks(await sacksApi.byPallet(pallet.palletId))
    } catch (err) {
      setDetailError((err as Error).message)
    } finally {
      setDetailLoading(false)
    }
  }

  const openFinalize = async (pallet: Pallet) => {
    setFinalizeTarget(pallet)
    setSelectedOutboundOrderId('')
    setOutboundOrders([])
    setFinalizeError(null)
    setFinalizeDestination(null)
    setOutboundLoading(true)

    try {
      const [orders, sacks] = await Promise.all([
        outboundOrdersApi.allForDispatch(),
        sacksApi.byPallet(pallet.palletId),
      ])
      const destinations = [...new Set(sacks.map((sack) => sack.nextHopId ?? sack.sDestination).filter(Boolean))]
      if (destinations.length !== 1) {
        setFinalizeError('Pallet outbound phải có đúng một điểm xuất hoặc next hop trước khi chốt.')
        return
      }
      setFinalizeDestination(destinations[0])
      setOutboundOrders(orders.filter((order) =>
        !['Completed', 'Cancelled', 'Fulfilled'].includes(order.status) &&
        order.outboundDestination === destinations[0],
      ))
    } catch (err) {
      setFinalizeError((err as Error).message)
    } finally {
      setOutboundLoading(false)
    }
  }

  const handleFinalize = async (event: FormEvent) => {
    event.preventDefault()
    if (!finalizeTarget || !selectedOutboundOrderId) return

    setSaving(true)
    setFinalizeError(null)
    try {
      await palletsApi.finalize(finalizeTarget.palletId, selectedOutboundOrderId)
      setFinalizeTarget(null)
      setNotice(`Đã chốt pallet ${finalizeTarget.palletId} và gán vào đơn xuất kho.`)
      load()
    } catch (err) {
      setFinalizeError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const movePallet = async (pallet: Pallet, zoneId: string) => {
    if (!zoneId || zoneId === pallet.zoneId) return
    setSaving(true)
    setError(null)
    try {
      await palletsApi.moveToZone(pallet.palletId, zoneId)
      setNotice(`Đã chuyển ${pallet.palletId} sang ${zoneName(zoneId)}.`)
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading && pallets.length === 0) return <LoadingState />
  if (error && pallets.length === 0) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Quản lý pallet"
        description="Theo dõi sức chứa, bao hàng, zone và trạng thái xuất kho của pallet."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Thêm pallet
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Tổng số</p><p className="mt-1 text-2xl font-semibold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Trống</p><p className="mt-1 text-2xl font-semibold">{stats.empty}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Đang chứa hàng</p><p className="mt-1 text-2xl font-semibold">{stats.occupied}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Đã chốt</p><p className="mt-1 text-2xl font-semibold">{stats.finalized}</p></CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_220px_220px_auto]">
          <div>
            <Label>Tìm kiếm</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mã pallet hoặc zone" />
            </div>
          </div>
          <div>
            <Label>Trạng thái</Label>
            <Select className="mt-1" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {statusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </Select>
          </div>
          <div>
            <Label>Zone</Label>
            <Select className="mt-1" value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}>
              <option value="">Tất cả zone</option>
              {zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.zoneName}</option>)}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={load} disabled={loading}>
                <RefreshCcw className="h-4 w-4" />
              Tải lại
            </Button>
          </div>
        </CardContent>
      </Card>

      {(error || notice) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error ?? notice}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pallets ({filteredPallets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã pallet</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Tên khu vực</TableHead>
                <TableHead>Sack tối đa</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Chuyển zone</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPallets.map((pallet) => (
                <TableRow key={pallet.palletId}>
                  <TableCell className="font-mono font-medium">{pallet.palletId}</TableCell>
                  <TableCell>{zoneProcessRoleLabel(zoneRole(pallet))}</TableCell>
                  <TableCell>{zoneName(pallet.zoneId)}</TableCell>
                  <TableCell>{pallet.capacity}</TableCell>
                  <TableCell><Badge status={pallet.status}>{statusLabel(pallet.status)}</Badge></TableCell>
                  <TableCell>
                    <Select value={pallet.zoneId} onChange={(event) => void movePallet(pallet, event.target.value)} disabled={saving || !['Empty', 'ReadyForOutbound'].includes(pallet.status)}>
                      {zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.zoneName}</option>)}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => void openDetails(pallet)} disabled={saving} title="Xem bao hàng trên pallet">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void openFinalize(pallet)} disabled={saving || pallet.status === 'Finalized' || pallet.status === 'Empty' || pallet.status === 'Locked' || !isDispatchProcessRole(zoneRole(pallet))} title="Chỉ chốt pallet ở Zone B hoặc Zone C">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => void deletePallet(pallet)} disabled={saving || pallet.status !== 'Empty'} title="Chỉ xóa pallet trống">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPallets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">Không có pallet phù hợp với bộ lọc hiện tại.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Thêm pallet"
        description="Mã pallet được hệ thống tự sinh sau khi tạo."
      >
        <form className="space-y-4" onSubmit={handleSave}>
          <div>
            <div className="flex items-center justify-between">
              <Label>Mã pallet</Label>
              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Tự động sinh mã
              </span>
            </div>
            <div className="mt-1 flex h-10 w-full items-center rounded-lg border border-slate-300 bg-slate-50 px-3">
              <span className="text-sm text-slate-500">Mã sẽ được cấp khi lưu</span>
            </div>
          </div>
          <div>
            <Label>Zone</Label>
            <Select value={form.zoneId} onChange={(event) => setForm({ ...form, zoneId: event.target.value })}>
              <option value="">Chọn zone</option>
              {zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.zoneName}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="pallet-capacity">Số sack tối đa</Label>
            <Input
              id="pallet-capacity"
              className="mt-1"
              type="number"
              min="1"
              max="6"
              step="1"
              value={form.capacity}
              onChange={(event) => setForm({ ...form, capacity: event.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500">Mỗi pallet chứa tối đa 6 sack.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo pallet'}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={detailPallet !== null}
        onClose={() => setDetailPallet(null)}
        title={detailPallet ? `Chi tiết pallet ${detailPallet.palletId}` : 'Chi tiết pallet'}
        description="Danh sách bao hàng đang được gán trên pallet."
        className="max-w-3xl"
      >
        {detailPallet && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Trạng thái</p>
                <div className="mt-1"><Badge status={detailPallet.status}>{statusLabel(detailPallet.status)}</Badge></div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Zone</p>
                <p className="mt-1 font-medium">{zoneProcessRoleLabel(zoneRole(detailPallet))}</p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Số sack / giới hạn</p>
                <p className="mt-1 font-medium">{detailSacks.length} / {detailPallet.capacity}</p>
              </div>
            </div>

            <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm font-semibold text-slate-800">QR ID pallet</p>
              <div className="mt-3">
                <PalletQrCode value={detailPallet.palletId} />
              </div>
              <p className="mt-3 break-all font-mono text-xs text-slate-600">{detailPallet.palletId}</p>
              <p className="mt-2 text-xs text-slate-500">Dùng mã này để xác nhận pallet trong Sorting Zone A.</p>
            </div>

            {detailLoading && <LoadingState message="Đang tải danh sách bao hàng..." />}
            {detailError && <ErrorState message={detailError} />}
            {!detailLoading && !detailError && (
              detailSacks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã bao</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Điểm đến</TableHead>
                      <TableHead>Điểm xuất</TableHead>
                      <TableHead>Zone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailSacks.map((sack) => (
                      <TableRow key={sack.sackId}>
                        <TableCell className="font-mono text-xs font-medium">{sack.sackId}</TableCell>
                        <TableCell><Badge status={sack.status}>{statusLabel(sack.status)}</Badge></TableCell>
                        <TableCell>{sack.sDestination}</TableCell>
                        <TableCell>{sack.nextHopId ?? sack.sDestination}</TableCell>
                        <TableCell>{sack.zoneId ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">Pallet này chưa có bao hàng.</p>
              )
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={finalizeTarget !== null}
        onClose={() => setFinalizeTarget(null)}
        title={finalizeTarget ? `Chốt pallet ${finalizeTarget.palletId}` : 'Chốt pallet'}
        description={finalizeTarget ? `Chỉ chốt ${zoneProcessRoleLabel(zoneRole(finalizeTarget))}; đơn xuất phải khớp điểm xuất của pallet.` : 'Chọn đơn xuất kho phù hợp.'}
      >
        <form className="space-y-4" onSubmit={handleFinalize}>
          <div>
            <Label htmlFor="outbound-order">Đơn xuất kho</Label>
            {finalizeDestination && <p className="mt-1 text-xs text-slate-500">Điểm xuất yêu cầu: <span className="font-mono font-semibold text-slate-700">{finalizeDestination}</span></p>}
            {outboundLoading ? (
              <LoadingState message="Đang tải đơn xuất kho..." />
            ) : (
              <Select
                id="outbound-order"
                className="mt-1"
                value={selectedOutboundOrderId}
                onChange={(event) => setSelectedOutboundOrderId(event.target.value)}
                disabled={outboundOrders.length === 0}
              >
                <option value="">Chọn đơn xuất kho</option>
                {outboundOrders.map((order) => (
                  <option key={order.outboundOrderId} value={order.outboundOrderId}>
                    {order.outboundOrderNumber} · {order.outboundDestination} · {statusLabel(order.status)}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {finalizeError && <ErrorState message={finalizeError} />}
          {!outboundLoading && !finalizeError && outboundOrders.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Không có đơn xuất kho đang chờ xử lý để gán pallet.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFinalizeTarget(null)}>Hủy</Button>
            <Button type="submit" disabled={saving || outboundLoading || !selectedOutboundOrderId}>
              {saving ? 'Đang chốt...' : 'Chốt pallet'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
