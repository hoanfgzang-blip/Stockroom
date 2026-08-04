import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { employeesApi, locationsApi, shiftsApi, zonesApi } from '@/api/services'
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
import { Combobox } from '@/components/shared/Combobox'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/auth/AuthContext'
import { formatTimeSpan, generatePreviewId, roleLabel } from '@/lib/utils'
import type { Employee, Location, Shift, Zone } from '@/types'

const emptyForm = (): Employee => ({
  employeeId: '',
  employeeName: '',
  roleName: 'Operator',
  locationId: '',
  zoneId: '',
  shiftId: '',
})

export default function EmployeesPage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [locationFilter, setLocationFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Employee>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [previewEmpId, setPreviewEmpId] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      employeesApi.all({ locationId: locationFilter || undefined }),
      locationsApi.all(),
      zonesApi.all(),
      shiftsApi.all(),
    ])
      .then(([e, l, z, s]) => {
        setEmployees(e)
        setLocations(l)
        setZones(z)
        setShifts(s)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [locationFilter])

  const locationOptions = locations.filter((location) => location.locationId === user?.locationId).map((l) => ({
    value: l.locationId,
    label: l.locationName,
    description: l.locationType,
  }))

  const zoneOptions = useMemo(
    () =>
      zones
        .filter((z) => !form.locationId || z.locationId === form.locationId)
        .map((z) => ({ value: z.zoneId, label: z.zoneName, description: z.zoneType })),
    [zones, form.locationId],
  )

  const shiftOptions = shifts.map((s) => ({
    value: s.shiftId,
    label: `${s.shiftName} (${formatTimeSpan(s.startAt)} – ${formatTimeSpan(s.endAt)})`,
  }))

  const getLocationName = (id?: string | null) => (id ? locations.find((l) => l.locationId === id)?.locationName ?? id : '—')
  const getZoneName = (id?: string | null) => zones.find((z) => z.zoneId === id)?.zoneName ?? id ?? '—'
  const openCreate = () => {
    setError(null)
    setForm({ ...emptyForm(), locationId: user?.locationId ?? '' })
    setPreviewEmpId(generatePreviewId('EMP'))
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.employeeName.trim()) {
      setError('Vui lòng nhập tên nhân viên')
      return
    }
    if (!form.shiftId) {
      setError('Vui lòng chọn ca làm việc')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload: Employee = {
        ...form,
        employeeId: previewEmpId,
        locationId: form.locationId || null,
        zoneId: form.zoneId || null,
      }
      await employeesApi.create(payload)
      setDialogOpen(false)
      setForm(emptyForm())
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading && employees.length === 0) return <LoadingState />
  if (error && employees.length === 0) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Employee Directory"
        description="Staff assignments by shift, hub, and warehouse zone."
        action={
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap gap-4 p-4">
          <div className="min-w-[200px]">
            <Label>Lọc theo địa điểm</Label>
            <Select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">Tất cả địa điểm</option>
                {locations.filter((location) => location.locationId === user?.locationId).map((l) => (
                <option key={l.locationId} value={l.locationId}>
                  {l.locationName}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employees ({employees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trung tâm</TableHead>
                <TableHead>Zone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.employeeId}>
                  <TableCell className="font-medium">{emp.employeeName}</TableCell>
                  <TableCell>
                    <Badge status={emp.roleName}>{roleLabel(emp.roleName)}</Badge>
                  </TableCell>
                  <TableCell>{getLocationName(emp.locationId)}</TableCell>
                  <TableCell>{getZoneName(emp.zoneId)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Create Employee"
        description="Assign hub, zone, and shift with relational autocomplete fields."
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}
          <div>
            <div className="flex items-center justify-between">
              <Label>Mã nhân viên</Label>
              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Tự động sinh mã
              </span>
            </div>
            <div className="mt-1 flex h-10 w-full items-center rounded-lg border border-slate-300 bg-slate-50 px-3">
              <span className="font-mono text-xs font-semibold text-slate-700">{previewEmpId}</span>
            </div>
          </div>
          <div>
            <Label>Tên nhân viên</Label>
            <Input
              value={form.employeeName}
              onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
            />
          </div>
          <div>
            <Label>Vai trò</Label>
            <Select
              value={form.roleName}
              onChange={(e) => setForm({ ...form, roleName: e.target.value })}
            >
              <option value="Operator">Nhân viên vận hành</option>
              <option value="Driver">Tài xế</option>
              <option value="Supervisor">Giám sát</option>
              <option value="Manager">Quản lý</option>
            </Select>
          </div>
          <div>
            <Label>Địa điểm kho</Label>
            <Combobox
              options={locationOptions}
              value={form.locationId || ''}
              onChange={(locationId) => setForm({ ...form, locationId, zoneId: '' })}
              placeholder="Search locations..."
            />
          </div>
          <div>
            <Label>Zone kho</Label>
            <Combobox
              options={zoneOptions}
              value={form.zoneId ?? ''}
              onChange={(zoneId) => setForm({ ...form, zoneId })}
              placeholder={form.locationId ? 'Tìm Zone...' : 'Chọn địa điểm trước'}
            />
          </div>
          <div>
            <Label>Ca làm việc</Label>
            <Combobox
              options={shiftOptions}
              value={form.shiftId}
              onChange={(shiftId) => setForm({ ...form, shiftId })}
              placeholder="Search shifts..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Tạo nhân viên'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
