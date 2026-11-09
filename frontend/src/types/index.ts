// Shared API types matching the SMAT NU Kudus backend contract.
// Base URL: /api/v1, JSON envelope { success, data } | { success, error }.

export type Role = "admin" | "bendahara" | "pengelola_aset" | "pemeriksa" | "pimpinan"

export type UserStatus = "aktif" | "nonaktif"

export interface User {
  id: string
  name: string
  email: string
  role: Role
  status?: UserStatus
  created_at?: string
}

export type TransactionType = "penerimaan" | "pengeluaran"

export type TransactionStatus =
  | "draft"
  | "menunggu_persetujuan"
  | "disetujui"
  | "ditolak"
  | "diposting"
  | "dibatalkan"

export type PaymentMethod = "tunai" | "transfer" | "berjangka"

export interface TransactionCategory {
  id: string
  name: string
  code?: string
  transaction_type: TransactionType
  default_account_id?: string | null
}

export interface Wakif {
  id: string
  name: string
  nik?: string | null
  phone?: string | null
  address?: string | null
  email?: string | null
  created_at?: string
}

export interface Transaction {
  id: string
  transaction_number: string
  transaction_type: TransactionType
  transaction_date: string // YYYY-MM-DD
  amount: number // integer rupiah
  description: string
  category_id: string
  category?: TransactionCategory | null
  wakif_id?: string | null
  wakif?: Wakif | null
  payment_method?: PaymentMethod | null
  rekening_id?: string | null
  source_of_funds?: string | null
  recipient?: string | null
  status: TransactionStatus
  rejection_note?: string | null
  rejection_reason?: string | null
  attachment_url?: string | null
  journal_id?: string | null
  created_by?: string | null
  created_by_name?: string | null
  approved_by?: string | null
  approved_at?: string | null
  posted_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface TransactionListParams {
  type?: TransactionType
  status?: TransactionStatus
  category_id?: string
  wakif_id?: string
  date_from?: string
  date_to?: string
  q?: string
  page?: number
  limit?: number
}
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface NewTransaction {
  transaction_type: TransactionType
  transaction_date: string
  amount: number
  description: string
  category_id: string
  wakif_id?: string | null
  payment_method?: PaymentMethod | null
  rekening_id?: string | null
  source_of_funds?: string | null
  recipient?: string | null
  attachment_url?: string | null
}

// Assets (PRD §6.5)
export type AssetType = "tanah" | "bangunan" | "uang" | "lainnya"

export type AssetStatus = "aktif" | "tidak_aktif" | "dihapuskan"

export interface AssetDocument {
  id: string
  asset_id: string
  document_type?: string | null
  description?: string | null
  file_name?: string | null
  file_size?: number | null
  url: string
  uploaded_by?: string | null
  created_at?: string
}

export interface Asset {
  id: string
  asset_code: string
  name: string
  asset_type: AssetType
  status: AssetStatus
  acquisition_date?: string | null
  acquisition_value?: number | null
  certificate_number?: string | null
  location?: string | null
  area?: number | null
  description?: string | null
  created_at?: string
  updated_at?: string
}

export interface AssetHistoryEntry {
  id: string
  asset_id: string
  action?: string
  description?: string
  performed_by?: string
  performed_by_name?: string
  created_at?: string
}

// Accounting
export interface ReportRow {
  account_id: string
  code: string
  name: string
  amount: number
}

export type AccountType = "aset" | "liabilitas" | "aset_neto" | "pendapatan" | "beban"

export interface Account {
  id: string
  code: string
  name: string
  account_type: AccountType
  parent_id?: string | null
  is_active?: boolean
}

export interface JournalLine {
  id?: string
  journal_id?: string
  account_id: string
  account_code?: string
  account_name?: string
  description?: string | null
  debit: number
  credit: number
}

export interface Journal {
  id: string
  journal_number: string
  journal_date: string
  entry_date?: string
  description?: string | null
  reference?: string | null
  source?: string | null
  status?: "draft" | "posted"
  posted_at?: string | null
  lines: JournalLine[]
  created_at?: string
}

export interface JournalListParams {
  q?: string
  date_from?: string
  date_to?: string
  page?: number
  limit?: number
}

export interface LedgerEntry {
  journal_id: string
  journal_number: string
  journal_date: string
  entry_date?: string
  account_id: string
  account_code?: string
  account_name?: string
  description?: string | null
  debit: number
  credit: number
  balance: number // running saldo
  running_balance?: number
}

export interface TrialBalanceRow {
  account_id: string
  code: string
  name: string
  account_type: AccountType
  beginning_balance: number
  opening?: number
  total_debit: number
  total_credit: number
  ending_balance: number
  closing?: number
}

// Dashboard
export interface DashboardSummary {
  total_penerimaan: number
  total_pengeluaran: number
  saldo_kas: number
  total_aset_wakaf: number
  jumlah_wakif?: number
  jumlah_transaksi?: number
  transaksi_menunggu_persetujuan?: number
  pending_transactions?: number
  transaction_count?: number
  pending_approval_count?: number
}

export interface CashFlowPoint {
  month: string // e.g. "2026-01"
  penerimaan: number
  pengeluaran: number
}

export interface AssetDistributionItem {
  asset_type: string
  count: number
  total_value: number
}

// Reports
export interface FinancialPositionReport {
  date?: string
  as_of?: string
  aset: ReportRow[]
  liabilitas: ReportRow[]
  aset_neto: ReportRow[]
  total_aset: number
  total_liabilitas: number
  total_aset_neto: number
  balanced?: boolean
}

export interface WaqfAssetsReport {
  items: Array<{
    asset_id: string
    asset_code: string
    name: string
    asset_type: string
    acquisition_date?: string | null
    acquisition_value?: number | null
    location?: string | null
  }>
  total_value: number
}

export interface ActivityReportItem {
  account_id: string
  code: string
  name: string
  account_type: AccountType
  amount: number
}

export interface ActivityGroup {
  key: string
  label: string
  code: string
  type: "pendapatan" | "beban"
  items: ActivityReportItem[]
  total: number
  surplus: number
}

export interface ActivitiesReport {
  date_from?: string
  date_to?: string
  groups?: ActivityGroup[]
  pendapatan: ActivityReportItem[]
  beban: ActivityReportItem[]
  total_pendapatan: number
  total_beban: number
  net_change: number
}

export interface CashFlowReport {
  date_from?: string
  date_to?: string
  operating?: Array<{ description: string; amount: number }>
  investing?: Array<{ description: string; amount: number }>
  financing?: Array<{ description: string; amount: number }>
  beginning_balance?: number
  net_change?: number
  ending_balance?: number
  penerimaan?: number
  pengeluaran?: number
}

export interface WorksheetRow {
  account_id: number
  code: string
  name: string
  account_type: AccountType
  unadjusted_debit: number
  unadjusted_credit: number
  adjustment_debit: number
  adjustment_credit: number
  adjusted_debit: number
  adjusted_credit: number
}

export interface WorksheetReport {
  as_of: string | null
  rows: WorksheetRow[]
  totals: Omit<WorksheetRow, "account_id" | "code" | "name" | "account_type">
  balanced: boolean
}

export interface ManagedAssetRow {
  name: string
  opening: number
  penambahan: number
  pengurangan: number
  revaluasi: number
  penyusutan: number
  closing: number
}

export interface ManagedAssetsReport {
  date_from: string | null
  date_to: string | null
  items: ManagedAssetRow[]
  totals: Omit<ManagedAssetRow, "name">
}

export interface NoteItem {
  title: string
  content: string
}

// Audit
export interface AuditLog {
  id: string
  user_id?: string | null
  user_name?: string | null
  action: string
  entity?: string | null
  entity_id?: string | null
  description?: string | null
  ip?: string | null
  created_at: string
}

// Envelope
export interface ApiError {
  code: string
  message: string
}
