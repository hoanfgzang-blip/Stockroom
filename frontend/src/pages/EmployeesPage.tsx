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
import { formatTimeSpan, roleLabel } from '@/lib/utils'
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
  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [shiftFilter, setShiftFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Employee>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      employeesApi.all({ shiftId: shiftFilter || undefined, locationId: locationFilter || undefined }),
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
  }, [shiftFilter, locationFilter])

  const locationOptions = locations.map((l) => ({
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

  const getLocationName = (id: string) => locations.find((l) => l.locationId === id)?.locationName ?? id
  const getZoneName = (id?: string | null) => zones.find((z) => z.zoneId === id)?.zoneName ?? id ?? '—'
  const getShiftName = (id: string) => {
    const s = shifts.find((sh) => sh.shiftId === id)
    return s ? `${s.shiftName} (${formatTimeSpan(s.startAt)}–${formatTimeSpan(s.endAt)})` : id
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await employeesApi.create(form)
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
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap gap-4 p-4">
          <div className="min-w-[200px]">
            <Label>Lọc theo ca</Label>
            <Select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
              <option value="">Tất cả ca</option>
              {shifts.map((s) => (
                <option key={s.shiftId} value={s.shiftId}>
                  {s.shiftName}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[200px]">
            <Label>Lọc theo địa điểm</Label>
            <Select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">Tất cả địa điểm</option>
              {locations.map((l) => (
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
                <TableHead>Ca làm việc</TableHead>
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
                  <TableCell>{getShiftName(emp.shiftId)}</TableCell>
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
          <div>
            <Label>Mã nhân viên</Label>
            <Input
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            />
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
              value={form.locationId}
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
