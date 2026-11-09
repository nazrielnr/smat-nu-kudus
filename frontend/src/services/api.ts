import type {
  Account,
  ActivitiesReport,
  ApiError,
  Asset,
  AssetDistributionItem,
  AssetDocument,
  AssetHistoryEntry,
  AuditLog,
  CashFlowPoint,
  CashFlowReport,
  DashboardSummary,
  FinancialPositionReport,
  Journal,
  JournalListParams,
  LedgerEntry,
  NewTransaction,
  NoteItem,
  Paginated,
  Transaction,
  TransactionCategory,
  TransactionListParams,
  TrialBalanceRow,
  User,
  Wakif,
  WaqfAssetsReport,
  WorksheetReport,
  ManagedAssetsReport,
} from "@/types"

const BASE = "/api/v1"

export class ApiClientError extends Error {
  code: string
  status: number

  constructor(error: ApiError, status: number) {
    super(error.message)
    this.code = error.code
    this.status = status
    this.name = "ApiClientError"
  }
}

type QueryParams = Record<string, string | number | boolean | undefined | null>

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

interface Envelope<T> {
  success?: boolean
  data?: T
  error?: ApiError
}

async function request<T>(path: string, init?: RequestInit, params?: QueryParams): Promise<T> {
  const isForm = init?.body instanceof FormData
  const res = await fetch(buildUrl(path, params), {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body !== undefined && !isForm
        ? { "Content-Type": "application/json" }
        : {}),
    },
  })

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (json === null) {
    if (!res.ok) {
      throw new ApiClientError(
        { code: "network_error", message: `Permintaan gagal (${res.status})` },
        res.status,
      )
    }
    return undefined as T
  }

  if (typeof json === "object" && json !== null && "success" in json) {
    const body = json as Envelope<T>
    if (body.success === false && body.error) {
      throw new ApiClientError(body.error, res.status)
    }
    if (!res.ok) {
      throw new ApiClientError(
        body.error ?? { code: "unknown_error", message: `Permintaan gagal (${res.status})` },
        res.status,
      )
    }
    return body.data as T
  }

  // Tolerant backends may return raw payloads without the envelope.
  if (!res.ok) {
    throw new ApiClientError(
      { code: "unknown_error", message: `Permintaan gagal (${res.status})` },
      res.status,
    )
  }
  return json as T
}

function get<T>(path: string, params?: QueryParams): Promise<T> {
  return request<T>(path, { method: "GET" }, params)
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body) })
}

function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) })
}

// ---------- Auth ----------
export const authApi = {
  login: (email: string, password: string) =>
    post<User>("/auth/login", { email, password }),
  me: () => get<User>("/auth/me"),
  logout: () => post<void>("/auth/logout"),
  changePassword: (oldPassword: string, newPassword: string) =>
    post<void>("/auth/change-password", { old_password: oldPassword, new_password: newPassword }),
}

// ---------- Wakif ----------
export const wakifApi = {
  list: (params?: { q?: string; page?: number; limit?: number }) =>
    get<Paginated<Wakif>>("/wakif", params),
  get: (id: string) => get<Wakif>(`/wakif/${id}`),
  create: (data: Partial<Wakif>) => post<Wakif>("/wakif", data),
  update: (id: string, data: Partial<Wakif>) => put<Wakif>(`/wakif/${id}`, data),
  transactions: (id: string, params?: TransactionListParams) =>
    get<Paginated<Transaction>>(`/wakif/${id}/transactions`, params as QueryParams),
}

// ---------- Transactions (JSON only; attachment is a URL string) ----------
export const transactionsApi = {
  list: (params?: TransactionListParams) =>
    get<Paginated<Transaction>>("/transactions", params as QueryParams),
  get: (id: string) => get<Transaction>(`/transactions/${id}`),
  create: (data: NewTransaction) => post<Transaction>("/transactions", data),
  update: (id: string, data: NewTransaction) => put<Transaction>(`/transactions/${id}`, data),
  submit: (id: string) => post<Transaction>(`/transactions/${id}/submit`),
  approve: (id: string, note?: string) =>
    post<Transaction>(`/transactions/${id}/approve`, note ? { note } : undefined),
  reject: (id: string, note: string) =>
    post<Transaction>(`/transactions/${id}/reject`, { note }),
  post: (id: string) => post<Transaction>(`/transactions/${id}/post`),
  reverse: (id: string, note?: string) =>
    post<Transaction>(`/transactions/${id}/reverse`, note ? { note } : undefined),
}

// ---------- Categories ----------
function pickArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === "object" && raw !== null) {
    for (const key of ["items", "data", "categories", "rows"] as const) {
      if (key in raw) {
        const value = (raw as Record<typeof key, unknown>)[key]
        if (Array.isArray(value)) return value
      }
    }
  }
  return []
}

export async function categoriesApi(params?: {
  transaction_type?: "penerimaan" | "pengeluaran"
}): Promise<TransactionCategory[]> {
  const raw = await get<unknown>("/transaction-categories", params as QueryParams)
  return pickArray(raw) as TransactionCategory[]
}

// ---------- Assets ----------
export const assetsApi = {
  list: (params?: { q?: string; asset_type?: string; status?: string; page?: number; limit?: number }) =>
    get<Paginated<Asset>>("/assets", params),
  get: (id: string) => get<Asset>(`/assets/${id}`),
  create: (data: Partial<Asset>) => post<Asset>("/assets", data),
  update: (id: string, data: Partial<Asset>) => put<Asset>(`/assets/${id}`, data),
  documents: (id: string) => get<AssetDocument[] | Paginated<AssetDocument>>(`/assets/${id}/documents`),
  uploadDocument: (id: string, file: File, documentType?: string, description?: string) => {
    const form = new FormData()
    form.append("file", file)
    if (documentType) form.append("document_type", documentType)
    if (description) form.append("description", description)
    return post<AssetDocument>(`/assets/${id}/documents`, form)
  },
  history: (id: string) => get<AssetHistoryEntry[] | Paginated<AssetHistoryEntry>>(`/assets/${id}/history`),
}

// ---------- Accounting ----------
export const accountsApi = {
  list: (params?: { q?: string; account_type?: string }) =>
    get<Account[] | Paginated<Account>>("/accounts", params),
  create: (data: { code: string; name: string; account_type: string; parent_id?: string | null }) =>
    post<Account>("/accounts", data),
}

export const journalsApi = {
  list: (params?: JournalListParams) =>
    get<Paginated<Journal>>("/journals", params as QueryParams),
  get: (id: string) => get<Journal>(`/journals/${id}`),
  post: (id: string) => post<Journal>(`/journals/${id}/post`),
}

export const ledgerApi = {
  get: (params: { account_id: string; date_from?: string; date_to?: string; page?: number; limit?: number }) =>
    get<Paginated<LedgerEntry>>("/ledger", params),
}

export const trialBalanceApi = {
  get: (date?: string) =>
    get<TrialBalanceRow[] | { rows?: TrialBalanceRow[]; items?: TrialBalanceRow[] }>(
      "/trial-balance",
      date ? { date } : undefined,
    ),
}

// ---------- Dashboard ----------
export const dashboardApi = {
  summary: () => get<DashboardSummary>("/dashboard/summary"),
  transactions: (limit = 10) =>
    get<Paginated<Transaction>>("/dashboard/transactions", { limit }),
  cashFlow: (months = 12) =>
    get<CashFlowPoint[] | { items?: CashFlowPoint[] }>("/dashboard/cash-flow", { months }),
  assets: () => get<AssetDistributionItem[] | { items?: AssetDistributionItem[] }>("/dashboard/assets"),
}

// ---------- Reports ----------
export const reportsApi = {
  financialPosition: (date?: string) =>
    get<FinancialPositionReport>("/reports/financial-position", date ? { date } : undefined),
  waqfAssets: (dateFrom?: string, dateTo?: string) =>
    get<WaqfAssetsReport>(
      "/reports/waqf-assets",
      dateFrom || dateTo ? { date_from: dateFrom, date_to: dateTo } : undefined,
    ),
  activities: (dateFrom?: string, dateTo?: string) =>
    get<ActivitiesReport>(
      "/reports/activities",
      dateFrom || dateTo ? { date_from: dateFrom, date_to: dateTo } : undefined,
    ),
  cashFlow: (dateFrom?: string, dateTo?: string) =>
    get<CashFlowReport>(
      "/reports/cash-flow",
      dateFrom || dateTo ? { date_from: dateFrom, date_to: dateTo } : undefined,
    ),
  worksheet: (date?: string) =>
    get<WorksheetReport>("/reports/worksheet", date ? { date } : undefined),
  managedAssets: (dateFrom?: string, dateTo?: string) =>
    get<ManagedAssetsReport>(
      "/reports/managed-assets",
      dateFrom || dateTo ? { date_from: dateFrom, date_to: dateTo } : undefined,
    ),
  notes: () => get<NoteItem[] | { items?: NoteItem[] }>("/reports/notes"),
}

// ---------- Settings ----------
export const settingsApi = {
  org: () => get<{ name: string }>("/settings/org"),
}

// ---------- Audit logs ----------
export const auditApi = {
  list: (params?: { q?: string; action?: string; date_from?: string; date_to?: string; page?: number; limit?: number }) =>
    get<Paginated<AuditLog>>("/audit-logs", params),
}

// ---------- Users (admin) ----------
export const usersApi = {
  list: (params?: { q?: string; role?: string; page?: number; limit?: number }) =>
    get<Paginated<User>>("/users", params),
  create: (data: { name: string; email: string; role: string; password?: string; status?: string }) =>
    post<User>("/users", data),
  update: (id: string, data: Partial<{ name: string; email: string; role: string; status: string }>) =>
    put<User>(`/users/${id}`, data),
  setStatus: (id: string, status: "aktif" | "nonaktif") =>
    patch<User>(`/users/${id}/status`, { status }),
}

// ---------- Normalizers for tolerant list shapes ----------
export function normalizeList<T>(
  raw: T[] | Paginated<T> | { items?: T[] } | { data?: T[] } | null | undefined,
): T[] {
  return pickArray(raw) as T[]
}

export function normalizePaginated<T>(
  raw: T[] | Paginated<T> | { items?: T[]; data?: T[] } | null | undefined,
  page = 1,
  limit = 10,
): Paginated<T> {
  if (raw == null) return { items: [], total: 0, page, limit, total_pages: 0 }
  if (Array.isArray(raw)) {
    // Client-side slice fallback for plain-array backends.
    const start = (page - 1) * limit
    return {
      items: raw.slice(start, start + limit),
      total: raw.length,
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(raw.length / limit)),
    }
  }
  const p = raw as Paginated<T>
  const items = normalizeList(raw)
  const total = p.total ?? items.length
  const resolvedPage = p.page ?? page
  const resolvedLimit = p.limit ?? limit
  return {
    items,
    total,
    page: resolvedPage,
    limit: resolvedLimit,
    total_pages:
      p.total_pages ?? Math.max(1, Math.ceil(total / resolvedLimit)),
  }
}

export { get, post, put, patch }
