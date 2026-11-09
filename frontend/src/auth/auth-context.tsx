import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { authApi } from "@/services/api"
import type { Role, User } from "@/types"

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  hasRole: (...roles: Role[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User | null
  children: ReactNode
}) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [isLoading, setIsLoading] = useState(false)
  const queryClient = useQueryClient()

  const login = useCallback(
    async (email: string, password: string) => {
      const logged = await authApi.login(email, password)
      setUser(logged)
      queryClient.clear()
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      queryClient.clear()
    }
  }, [queryClient])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const me = await authApi.me()
      setUser(me)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const hasRole = useCallback(
    (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    [user],
  )

  const value = useMemo(
    () => ({ user, isLoading, login, logout, refresh, hasRole }),
    [user, isLoading, login, logout, refresh, hasRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider")
  return ctx
}
