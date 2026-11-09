import { AuthBootstrap } from "@/auth/AuthBootstrap"
import { Navigate, Route, Routes } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { ProtectedRoute } from "@/components/routes/ProtectedRoute"
import type { Role } from "@/types"
import LoginPage from "@/pages/LoginPage"
import DashboardPage from "@/pages/DashboardPage"
import WakifListPage from "@/pages/WakifListPage"
import WakifDetailPage from "@/pages/WakifDetailPage"
import TransactionListPage from "@/pages/TransactionListPage"
import TransactionFormPage from "@/pages/TransactionFormPage"
import TransactionDetailPage from "@/pages/TransactionDetailPage"
import ApprovalPage from "@/pages/ApprovalPage"
import AssetListPage from "@/pages/AssetListPage"
import AssetFormPage from "@/pages/AssetFormPage"
import AssetDetailPage from "@/pages/AssetDetailPage"
import AccountsPage from "@/pages/AccountsPage"
import JournalsPage from "@/pages/JournalsPage"
import JournalDetailPage from "@/pages/JournalDetailPage"
import LedgerPage from "@/pages/LedgerPage"
import TrialBalancePage from "@/pages/TrialBalancePage"
import FinancialPositionPage from "@/pages/reports/FinancialPositionPage"
import WaqfAssetsPage from "@/pages/reports/WaqfAssetsPage"
import ActivitiesPage from "@/pages/reports/ActivitiesPage"
import CashFlowReportPage from "@/pages/reports/CashFlowReportPage"
import WorksheetPage from "@/pages/reports/WorksheetPage"
import ManagedAssetsPage from "@/pages/reports/ManagedAssetsPage"
import NotesPage from "@/pages/reports/NotesPage"
import AuditLogsPage from "@/pages/AuditLogsPage"
import UsersPage from "@/pages/UsersPage"
import SettingsPage from "@/pages/SettingsPage"
import NotFoundPage from "@/pages/NotFoundPage"

const ALL_ROLES: Role[] = ["admin", "bendahara", "pengelola_aset", "pemeriksa", "pimpinan"]

export default function App() {
  return (
    <AuthBootstrap>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute roles={ALL_ROLES} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/wakif" element={<WakifListPage />} />
          <Route path="/wakif/:id" element={<WakifDetailPage />} />
          <Route
            path="/penerimaan"
            element={<TransactionListPage transactionType="penerimaan" />}
          />
          <Route
            path="/penerimaan/new"
            element={<TransactionFormPage transactionType="penerimaan" />}
          />
          <Route
            path="/penerimaan/:id/edit"
            element={<TransactionFormPage transactionType="penerimaan" />}
          />
          <Route
            path="/pengeluaran"
            element={<TransactionListPage transactionType="pengeluaran" />}
          />
          <Route
            path="/pengeluaran/new"
            element={<TransactionFormPage transactionType="pengeluaran" />}
          />
          <Route
            path="/pengeluaran/:id/edit"
            element={<TransactionFormPage transactionType="pengeluaran" />}
          />
          <Route path="/transactions/:id" element={<TransactionDetailPage />} />
          <Route
            path="/persetujuan"
            element={
              <ProtectedRoute roles={["admin", "pemeriksa", "pimpinan", "bendahara"]}>
                <ApprovalPage />
              </ProtectedRoute>
            }
          />
          <Route path="/assets" element={<AssetListPage />} />
          <Route path="/assets/new" element={<AssetFormPage />} />
          <Route path="/assets/:id" element={<AssetDetailPage />} />
          <Route path="/assets/:id/edit" element={<AssetFormPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/journals" element={<JournalsPage />} />
          <Route path="/journals/:id" element={<JournalDetailPage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/trial-balance" element={<TrialBalancePage />} />
          <Route path="/reports/financial-position" element={<FinancialPositionPage />} />
          <Route path="/reports/waqf-assets" element={<WaqfAssetsPage />} />
          <Route path="/reports/activities" element={<ActivitiesPage />} />
          <Route path="/reports/cash-flow" element={<CashFlowReportPage />} />
          <Route path="/reports/worksheet" element={<WorksheetPage />} />
          <Route path="/reports/managed-assets" element={<ManagedAssetsPage />} />
          <Route path="/reports/notes" element={<NotesPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/users" element={<ProtectedRoute roles={["admin"]}><UsersPage /></ProtectedRoute>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </AuthBootstrap>
  )
}
