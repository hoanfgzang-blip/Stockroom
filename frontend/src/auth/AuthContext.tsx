import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '@/api/services'

export type AuthUser = {
  userId: string
  username: string
  employeeName: string
  roleName: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string, rememberMe: boolean) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (username, password, rememberMe) => {
      const account = await authApi.login({ username, password, rememberMe })
      setUser(account)
    },
    logout: async () => {
      await authApi.logout()
      setUser(null)
    },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider.')
  return context
}
