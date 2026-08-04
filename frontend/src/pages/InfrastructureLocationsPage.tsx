import { useEffect, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
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

export default function InfrastructureLocationsPage() {
  const [tab, setTab] = useState('locations')
  const [provinces, setProvinces] = useState<Province[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [provinceFilter, setProvinceFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog & form state for editing one of the three operational hubs.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [form, setForm] = useState<LocationFormState>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = () => {
    setLoading(true)
    Promise.all([provincesApi.all(), locationsApi.dispatchDestinations()])
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
    setForm((prev) => ({ ...prev, provinceId: newProvinceId }))
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
      if (!editingLocation) return
      await locationsApi.update(editingLocation.locationId, {
        locationId: form.locationId,
        provinceId: form.provinceId,
        locationType: form.locationType,
        locationName: form.locationName.trim(),
      })
      setDialogOpen(false)
      loadData()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Không thể lưu thông tin địa điểm.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && locations.length === 0) return <LoadingState />
  if (error && locations.length === 0) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Quản lý hạ tầng"
        description="Mạng lưới vận hành cố định quanh 3 hub: Hà Nội, Hồ Chí Minh và Đà Nẵng."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger active={tab === 'locations'} onClick={() => setTab('locations')}>
            Provinces & Locations
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
                          {loc.locationType === 'Hub' && (
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(loc)} title="Sửa địa điểm">
                              <Pencil className="h-4 w-4 text-slate-600" />
                            </Button>
                          )}
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
                    <TableHead>Số địa điểm</TableHead>
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

      {/* Modal Dialog chỉnh sửa một trong ba hub vận hành */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Chỉnh sửa địa điểm / Hub"
        description={editingLocation ? `Cập nhật thông tin cho mã ${editingLocation.locationId}` : undefined}
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
              disabled
              className="mt-1"
            >
              <option value="Hub">Hub kho</option>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

