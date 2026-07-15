import { FormEvent, useState } from 'react'
import { LockKeyhole, Warehouse } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password, rememberMe)
    } catch (reason) {
      setError(reason instanceof Error ? 'Tên đăng nhập hoặc mật khẩu không đúng.' : 'Không thể đăng nhập.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-white">
            <Warehouse className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">WMS Console</h1>
            <p className="text-sm text-slate-500">Đăng nhập hệ thống vận hành kho</p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={submit}>
          <div>
            <Label htmlFor="username">Tên đăng nhập</Label>
            <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="mt-1" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            Duy trì đăng nhập trên thiết bị này
          </label>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            <LockKeyhole className="h-4 w-4" />
            {submitting ? 'Đang đăng nhập' : 'Đăng nhập'}
          </Button>
        </form>
      </section>
    </main>
  )
}
