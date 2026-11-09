import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/auth/auth-context"
import type { Role } from "@/types"

interface ProtectedRouteProps {
  roles: Role[]
  children?: React.ReactNode
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!roles.includes(user.role)) {
    // Role guard: redirect unauthorized roles back to the dashboard.
    return <Navigate to="/" replace />
  }

  return children !== undefined ? <>{children}</> : <Outlet />
}
