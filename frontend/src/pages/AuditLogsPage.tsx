import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { auditApi, normalizePaginated } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDateTime } from "@/lib/format"
import type { AuditLog } from "@/types"

const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  "transaction.create": "Buat Transaksi",
  "transaction.update": "Ubah Transaksi",
  "transaction.submit": "Ajukan Transaksi",
  "transaction.approve": "Setujui Transaksi",
  "transaction.reject": "Tolak Transaksi",
  "transaction.post": "Posting Transaksi",
  "transaction.reverse": "Jurnal Balik Transaksi",
  "asset.create": "Tambah Aset",
  "asset.update": "Ubah Aset",
  "asset.document.upload": "Unggah Dokumen Aset",
  "journal.post": "Posting Jurnal",
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<string | "all">("all")

  const list = useQuery({
    queryKey: queryKeys.auditLogs({ page, limit: 15, action: action === "all" ? undefined : action }),
    queryFn: () => auditApi.list({ page, limit: 15, action: action === "all" ? undefined : action }),
  })

  const paginated = normalizePaginated(list.data, page, 15)

  const columns: DataTableColumn<AuditLog>[] = [
    { key: "time", header: "Waktu", render: (l) => formatDateTime(l.created_at) },
    {
      key: "user",
      header: "Pengguna",
      render: (l) => l.user_name ?? l.user_id ?? "-",
    },
    {
      key: "action",
      header: "Aksi",
      render: (l) => <Badge variant="secondary">{actionLabel(l.action)}</Badge>,
    },
    {
      key: "entity",
      header: "Objek",
      render: (l) => (
        <span className="text-muted-foreground">
          {l.entity ? `${l.entity}${l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}` : "-"}
        </span>
      ),
    },
    {
      key: "description",
      header: "Keterangan",
      render: (l) => (
        <span className="block max-w-80 truncate">{l.description ?? "-"}</span>
      ),
    },
    {
      key: "ip",
      header: "IP",
      render: (l) => <span className="font-mono text-xs">{l.ip ?? "-"}</span>,
    },
  ]

  const err = list.error instanceof Error ? list.error.message : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit Trail"
        description="Jejak audit seluruh aktivitas sistem (append-only)"
      />
      <DataTable<AuditLog>
        title="Log Aktivitas"
        description={`Total ${paginated.total} entri`}
        columns={columns}
        rows={paginated.items}
        rowKey={(l) => l.id}
        isLoading={list.isLoading}
        error={err}
        emptyTitle="Belum ada log aktivitas"
        emptyDescription="Aktivitas akan tercatat di sini."
        searchPredicate={(l, q) => {
          const inq = q.toLowerCase()
          return (
            (l.user_name ?? "").toLowerCase().includes(inq) ||
            actionLabel(l.action).toLowerCase().includes(inq) ||
            (l.description ?? "").toLowerCase().includes(inq)
          )
        }}
        searchPlaceholder="Cari pengguna, aksi, atau keterangan..."
        page={paginated.page}
        totalPages={paginated.total_pages}
        total={paginated.total}
        onPageChange={setPage}
        toolbar={
          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v ?? "all")
              setPage(1)
            }}
          >
            <SelectTrigger size="sm" className="w-48">
              <SelectValue placeholder="Semua Aksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Aksi</SelectItem>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </div>
  )
}
