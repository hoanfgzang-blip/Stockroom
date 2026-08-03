import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react'
import { palletsApi, zonesApi } from '@/api/services'
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
import type { Pallet, Zone } from '@/types'

const statusOptions = ['Empty', 'Occupied', 'In Transit to Zone', 'Finalized', 'Locked']

const emptyForm = () => ({
  zoneId: '',
})

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

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([palletsApi.all(statusFilter || undefined), zonesApi.all()])
      .then(([palletData, zoneData]) => {
        setPallets(palletData)
        setZones(zoneData)
        if (!form.zoneId && zoneData.length > 0) setForm((current) => ({ ...current, zoneId: zoneData[0].zoneId }))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  const zoneName = (id: string) => zones.find((z) => z.zoneId === id)?.zoneName ?? id

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
      setError('Hay chon khu vuc dat pallet.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await palletsApi.create({ zoneId: form.zoneId })
      setDialogOpen(false)
      setNotice('Da tao pallet moi. He thong da tu sinh ma pallet va dat trang thai rong.')
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const deletePallet = async (pallet: Pallet) => {
    if (!window.confirm(`Xoa pallet ${pallet.palletId}?`)) return
    setSaving(true)
    setError(null)
    try {
      await palletsApi.delete(pallet.palletId)
      setNotice('Da xoa pallet.')
      load()
    } catch (err) {
      setError((err as Error).message)
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
      setNotice(`Da chuyen ${pallet.palletId} sang ${zoneName(zoneId)}.`)
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const finalizePallet = async (pallet: Pallet) => {
    if (!window.confirm(`Chot pallet ${pallet.palletId} de san sang xuat kho?`)) return
    setSaving(true)
    setError(null)
    try {
      await palletsApi.finalize(pallet.palletId)
      setNotice('Da chot pallet.')
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
        title="Pallet Management"
        description="Create, classify, move, finalize, and audit warehouse pallets."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Pallet
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
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pallet ID or zone" />
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
              Refresh
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
                <TableHead>Trạng thái</TableHead>
                <TableHead>Chuyển zone</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPallets.map((pallet) => (
                <TableRow key={pallet.palletId}>
                  <TableCell className="font-mono font-medium">{pallet.palletId}</TableCell>
                  <TableCell>{zoneName(pallet.zoneId)}</TableCell>
                  <TableCell><Badge status={pallet.status}>{statusLabel(pallet.status)}</Badge></TableCell>
                  <TableCell>
                    <Select value={pallet.zoneId} onChange={(event) => void movePallet(pallet, event.target.value)} disabled={saving || pallet.status === 'Finalized' || pallet.status === 'Locked'}>
                      {zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.zoneName}</option>)}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => void finalizePallet(pallet)} disabled={saving || pallet.status === 'Finalized' || pallet.status === 'Empty'} title="Finalize pallet">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => void deletePallet(pallet)} disabled={saving} title="Delete pallet">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPallets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">No pallets match the current filters.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Create Pallet"
        description="The system automatically generates the pallet ID. Its status changes during scanning operations."
      >
        <form className="space-y-4" onSubmit={handleSave}>
          <div>
            <Label>Zone</Label>
            <Select value={form.zoneId} onChange={(event) => setForm({ ...form, zoneId: event.target.value })}>
              <option value="">Chọn zone</option>
              {zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.zoneName}</option>)}
            </Select>
          </div>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Ma pallet do he thong tu sinh. Trang thai ban dau la Empty va se duoc cap nhat khi nhan vien quet pallet.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo pallet'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
