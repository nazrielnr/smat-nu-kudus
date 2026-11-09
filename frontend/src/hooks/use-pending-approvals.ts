import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/auth/auth-context"
import { dashboardApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import type { Role } from "@/types"

const APPROVER_ROLES: Role[] = ["admin", "pemeriksa", "pimpinan", "bendahara"]

/** Count of transactions awaiting approval; 0 for roles that cannot see approvals. */
export function usePendingApprovals(): number {
  const { user } = useAuth()
  const allowed = !!user && APPROVER_ROLES.includes(user.role)
  const summary = useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: () => dashboardApi.summary(),
    enabled: allowed,
  })
  const s = summary.data
  return allowed
    ? (s?.transaksi_menunggu_persetujuan ?? s?.pending_transactions ?? s?.pending_approval_count ?? 0)
    : 0
}
