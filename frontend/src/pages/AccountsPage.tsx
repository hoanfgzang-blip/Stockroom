import { useEffect, useState } from 'react'
import { Pencil, Plus, UserRoundX } from 'lucide-react'
import { accountsApi, employeesApi, type ManagedAccount, type SaveAccountRequest } from '@/api/services'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/input'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/PageHeader'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Employee } from '@/types'
import { roleLabel } from '@/lib/utils'

type AccountForm = SaveAccountRequest & { userId?: string }

const emptyForm = (): AccountForm => ({
  employeeId: '',
  username: '',
  password: '',
  roleName: 'WarehouseStaff',
  isActive: true,
})

const roles = ['Manager', 'Supervisor', 'WarehouseStaff', 'Operator', 'Driver']

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<AccountForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([accountsApi.all(), employeesApi.all()])
      .then(([accountList, employeeList]) => {
        setAccounts(accountList)
        setEmployees(employeeList)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setForm(emptyForm())
    setDialogOpen(true)
  }

  const openEdit = (account: ManagedAccount) => {
    setForm({
      userId: account.userId,
      employeeId: account.employeeId,
      username: account.username,
      password: '',
      roleName: account.roleName,
      isActive: account.isActive,
    })
    setDialogOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload: SaveAccountRequest = { ...form }
      delete (payload as AccountForm).userId
      if (form.userId) await accountsApi.update(form.userId, payload)
      else await accountsApi.create(payload)
      setDialogOpen(false)
      load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu tài khoản.')
    } finally {
      setSaving(false)
    }
  }

  const disable = async (account: ManagedAccount) => {
    if (!window.confirm(`Vô hiệu hóa tài khoản ${account.username}?`)) return
    try {
      await accountsApi.disable(account.userId)
      load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể vô hiệu hóa tài khoản.')
    }
  }

  const availableEmployees = employees.filter((employee) => !accounts.some((account) => account.employeeId === employee.employeeId) || employee.employeeId === form.employeeId)

  if (loading && accounts.length === 0) return <LoadingState />
  if (error && accounts.length === 0) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Quản lý tài khoản"
        description="Tạo và quản trị quyền truy cập của nhân viên vào WMS."
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" />Tạo tài khoản</Button>}
      />
      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      <Card>
        <CardHeader><CardTitle>Tài khoản ({accounts.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nhân viên</TableHead><TableHead>Tên đăng nhập</TableHead><TableHead>Vai trò</TableHead><TableHead>Trạng thái</TableHead><TableHead className="w-28">Thao tác</TableHead></TableRow></TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.userId}>
                  <TableCell><p className="font-medium">{account.employeeName}</p><p className="font-mono text-xs text-slate-500">{account.employeeId}</p></TableCell>
                  <TableCell className="font-mono">{account.username}</TableCell>
                  <TableCell><Badge status={account.roleName}>{roleLabel(account.roleName)}</Badge></TableCell>
                  <TableCell><Badge status={account.isActive ? 'Active' : 'Inactive'}>{account.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(account)} title="Sửa tài khoản" aria-label="Sửa tài khoản"><Pencil className="h-4 w-4" /></Button>
                      {account.isActive && <Button variant="ghost" size="sm" onClick={() => disable(account)} title="Vô hiệu hóa tài khoản" aria-label="Vô hiệu hóa tài khoản"><UserRoundX className="h-4 w-4 text-red-600" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={form.userId ? 'Sửa tài khoản' : 'Tạo tài khoản'}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="account-employee">Nhân viên</Label>
            <Select id="account-employee" value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} disabled={Boolean(form.userId)} className="mt-1">
              <option value="">Chọn nhân viên</option>
              {availableEmployees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeName}</option>)}
            </Select>
          </div>
          <div><Label htmlFor="account-username">Tên đăng nhập</Label><Input id="account-username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="mt-1" /></div>
          <div><Label htmlFor="account-password">{form.userId ? 'Mật khẩu mới' : 'Mật khẩu'}</Label><Input id="account-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value.replace(/[^\x21-\x7E]/g, '') })} placeholder={form.userId ? 'Để trống nếu không đổi' : 'Ít nhất 8 ký tự'} className="mt-1" /></div>
          <div>
            <Label htmlFor="account-role">Vai trò</Label>
            <Select id="account-role" value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value })} className="mt-1">
              {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Đang hoạt động</label>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button><Button onClick={save} disabled={saving || !form.employeeId || !form.username || (!form.userId && !form.password)}>{saving ? 'Đang lưu' : 'Lưu tài khoản'}</Button></div>
        </div>
      </Dialog>
    </div>
  )
}
