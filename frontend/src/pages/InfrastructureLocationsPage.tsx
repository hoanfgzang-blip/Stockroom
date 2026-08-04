import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { locationsApi, provincesApi } from '@/api/services'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { statusLabel } from '@/lib/utils'
import type { Location, Province } from '@/types'

type LocationFormState = {
  locationId: string
  provinceId: string
  locationType: string
  locationName: string
}

const defaultForm: LocationFormState = {
  locationId: '',
  provinceId: '',
  locationType: 'Hub',
  locationName: '',
}

const generateLocationId = (provinceId: string, locationType: string, existingLocs: Location[]) => {
  const prefixMap: Record<string, string> = {
    Hub: 'HUB',
    Warehouse: 'WH',
    SortingCenter: 'SC',
    DistributionCenter: 'DC',
  }
  const prefix = prefixMap[locationType] ?? 'HUB'
  const prov = provinceId || '01'
  const pattern = new RegExp(`^${prefix}-${prov}-(\\d+)$`, 'i')
  let maxNum = 0
  for (const loc of existingLocs) {
    const match = loc.locationId.match(pattern)
    if (match) {
      const num = parseInt(match[1], 10)
      if (!isNaN(num) && num > maxNum) {
        maxNum = num
      }
    }
  }
  const nextNum = (maxNum + 1).toString().padStart(2, '0')
  return `${prefix}-${prov}-${nextNum}`
}

export default function InfrastructureLocationsPage() {
  const [tab, setTab] = useState('locations')
  const [provinces, setProvinces] = useState<Province[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [provinceFilter, setProvinceFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog & Form states for Add/Edit Hub Location
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [form, setForm] = useState<LocationFormState>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = () => {
    setLoading(true)
    Promise.all([provincesApi.all(), locationsApi.all()])
      .then(([p, l]) => {
        setProvinces(p)
        setLocations(l)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredLocations = useMemo(() => {
    if (!provinceFilter) return locations
    return locations.filter((l) => l.provinceId === provinceFilter)
  }, [locations, provinceFilter])

  const openCreateDialog = () => {
    setEditingLocation(null)
    const initialProvince = provinces[0]?.provinceId ?? '01'
    const initialType = 'Hub'
    const autoId = generateLocationId(initialProvince, initialType, locations)
    setForm({
      locationId: autoId,
      provinceId: initialProvince,
      locationType: initialType,
      locationName: '',
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const openEditDialog = (loc: Location) => {
    setEditingLocation(loc)
    setForm({
      locationId: loc.locationId,
      provinceId: loc.provinceId,
      locationType: loc.locationType,
      locationName: loc.locationName,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const handleProvinceChange = (newProvinceId: string) => {
    if (!editingLocation) {
      const newAutoId = generateLocationId(newProvinceId, form.locationType, locations)
      setForm((prev) => ({ ...prev, provinceId: newProvinceId, locationId: newAutoId }))
    } else {
      setForm((prev) => ({ ...prev, provinceId: newProvinceId }))
    }
  }

  const handleLocationTypeChange = (newType: string) => {
    if (!editingLocation) {
      const newAutoId = generateLocationId(form.provinceId, newType, locations)
      setForm((prev) => ({ ...prev, locationType: newType, locationId: newAutoId }))
    } else {
      setForm((prev) => ({ ...prev, locationType: newType }))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.locationId.trim() || !form.provinceId.trim() || !form.locationName.trim()) {
      setFormError('Vui lòng điền đầy đủ các thông tin bắt buộc.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      if (editingLocation) {
        // Edit location
        await locationsApi.update(editingLocation.locationId, {
          locationId: form.locationId,
          provinceId: form.provinceId,
          locationType: form.locationType,
          locationName: form.locationName,
        })
      } else {
        // Create location
        await locationsApi.create({
          locationId: form.locationId.trim(),
          provinceId: form.provinceId,
          locationType: form.locationType,
          locationName: form.locationName.trim(),
        })
      }
      setDialogOpen(false)
      loadData()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Không thể lưu thông tin địa điểm.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (loc: Location) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa địa điểm/hub "${loc.locationName}" (${loc.locationId})?`)) {
      return
    }

    try {
      await locationsApi.delete(loc.locationId)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Không thể xóa địa điểm này.')
    }
  }

  if (loading && locations.length === 0) return <LoadingState />
  if (error && locations.length === 0) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Quản lý hạ tầng"
        description="Tỉnh, hub kho và cấu trúc địa điểm."
        action={
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />
            Thêm địa điểm / Hub
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger active={tab === 'locations'} onClick={() => setTab('locations')}>
            Provinces & Hubs
          </TabsTrigger>
          <TabsTrigger active={tab === 'provinces'} onClick={() => setTab('provinces')}>
            Province Registry
          </TabsTrigger>
        </TabsList>

        <TabsContent active={tab === 'locations'}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Địa điểm và hub ({filteredLocations.length})</CardTitle>
              <div className="flex items-center gap-3">
                <div className="w-56">
                  <Label className="sr-only">Lọc theo tỉnh</Label>
                  <Select value={provinceFilter} onChange={(e) => setProvinceFilter(e.target.value)}>
                    <option value="">Tất cả tỉnh</option>
                    {provinces.map((p) => (
                      <option key={p.provinceId} value={p.provinceId}>
                        {p.provinceName}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên địa điểm</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Tỉnh / Thành phố</TableHead>
                    <TableHead>Mã ID</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.map((loc) => (
                    <TableRow key={loc.locationId}>
                      <TableCell className="font-medium">{loc.locationName}</TableCell>
                      <TableCell>
                        <Badge status={loc.locationType}>{statusLabel(loc.locationType)}</Badge>
                      </TableCell>
                      <TableCell>{loc.province?.provinceName ?? loc.provinceId}</TableCell>
                      <TableCell className="font-mono text-xs">{loc.locationId}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(loc)} title="Sửa địa điểm">
                            <Pencil className="h-4 w-4 text-slate-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(loc)} title="Xóa địa điểm">
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLocations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-slate-500">
                        Chưa có địa điểm nào phù hợp.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent active={tab === 'provinces'}>
          <Card>
            <CardHeader>
              <CardTitle>Tỉnh</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên tỉnh</TableHead>
                    <TableHead>Mã tỉnh</TableHead>
                    <TableHead>Số hub</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {provinces.map((p) => (
                    <TableRow key={p.provinceId}>
                      <TableCell className="font-medium">{p.provinceName}</TableCell>
                      <TableCell className="font-mono text-xs">{p.provinceId}</TableCell>
                      <TableCell>
                        {locations.filter((l) => l.provinceId === p.provinceId).length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Dialog thêm / sửa Địa điểm Hub */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingLocation ? 'Chỉnh sửa địa điểm / Hub' : 'Thêm mới địa điểm / Hub'}
        description={editingLocation ? `Cập nhật thông tin cho mã ${editingLocation.locationId}` : 'Khai báo địa điểm hoặc hub kho mới trong hệ thống.'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="locationId">Mã địa điểm / Hub</Label>
              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Tự động sinh mã
              </span>
            </div>
            <Input
              id="locationId"
              value={form.locationId}
              disabled
              required
              className="mt-1 font-mono bg-slate-100 font-bold text-slate-700 cursor-not-allowed"
            />
          </div>

          <div>
            <Label htmlFor="locationName">Tên địa điểm / Hub *</Label>
            <Input
              id="locationName"
              value={form.locationName}
              onChange={(e) => setForm({ ...form, locationName: e.target.value })}
              placeholder="VD: Hub Kho Tân Bình, Hub Hà Đông..."
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="provinceId">Tỉnh / Thành phố *</Label>
            <Select
              id="provinceId"
              value={form.provinceId}
              onChange={(e) => handleProvinceChange(e.target.value)}
              required
              className="mt-1"
            >
              <option value="" disabled>-- Chọn Tỉnh / Thành phố --</option>
              {provinces.map((p) => (
                <option key={p.provinceId} value={p.provinceId}>
                  {p.provinceName} ({p.provinceId})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="locationType">Loại địa điểm *</Label>
            <Select
              id="locationType"
              value={form.locationType}
              onChange={(e) => handleLocationTypeChange(e.target.value)}
              required
              className="mt-1"
            >
              <option value="Hub">Hub kho</option>
              <option value="Warehouse">Kho hàng</option>
              <option value="SortingCenter">Trung tâm chia chọn (Sorting Center)</option>
              <option value="DistributionCenter">Trung tâm phân phối (Distribution Center)</option>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : editingLocation ? 'Lưu thay đổi' : 'Thêm mới'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

