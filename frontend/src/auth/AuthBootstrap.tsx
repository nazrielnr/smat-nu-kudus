import { useEffect, useState, type ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { AuthProvider } from "@/auth/auth-context"
import { authApi } from "@/services/api"
import type { User } from "@/types"

/**
 * Resolves the current session once before rendering the app shell,
 * then provides auth state via AuthProvider.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    authApi
      .me()
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (user === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-2 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
        <span className="text-sm">Memuat sesi...</span>
      </div>
    )
  }

  return <AuthProvider initialUser={user}>{children}</AuthProvider>
}
