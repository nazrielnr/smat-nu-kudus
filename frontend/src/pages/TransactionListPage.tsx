import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { Amount } from "@/components/shared/Amount"
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/auth/auth-context"
import { categoriesApi, normalizeList, transactionsApi } from "@/services/api"
import { normalizePaginated } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate } from "@/lib/format"
import { useState } from "react"
import type { Transaction, TransactionStatus, TransactionType } from "@/types"

const STATUS_OPTIONS: { value: TransactionStatus | "all"; label: string }[] = [
  { value: "all", label: "Semua Status" },
  { value: "draft", label: "Draft" },
  { value: "menunggu_persetujuan", label: "Menunggu Persetujuan" },
  { value: "disetujui", label: "Disetujui" },
  { value: "ditolak", label: "Ditolak" },
  { value: "diposting", label: "Diposting" },
  { value: "dibatalkan", label: "Dibatalkan" },
]

interface TransactionListPageProps {
  transactionType: TransactionType
}

export default function TransactionListPage({ transactionType }: TransactionListPageProps) {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const canCreate = hasRole("admin", "bendahara")
  const isPenerimaan = transactionType === "penerimaan"

  const [status, setStatus] = useState<TransactionStatus | "all">("all")
  const [categoryId, setCategoryId] = useState<string | "all">("all")
  const [page, setPage] = useState(1)

  const categories = useQuery({
    queryKey: queryKeys.categories({ transaction_type: transactionType }),
    queryFn: () => categoriesApi({ transaction_type: transactionType }),
  })

  const list = useQuery({
    queryKey: queryKeys.transactions({
      type: transactionType,
      status: status === "all" ? undefined : status,
      category_id: categoryId === "all" ? undefined : categoryId,
      page,
      limit: 10,
    }),
    queryFn: () =>
      transactionsApi.list({
        type: transactionType,
        status: status === "all" ? undefined : status,
        category_id: categoryId === "all" ? undefined : categoryId,
        page,
        limit: 10,
      }),
  })

  const paginated = normalizePaginated(list.data, page, 10)

  const columns: DataTableColumn<Transaction>[] = [
    {
      key: "number",
      header: "Nomor",
      render: (t) => (
        <Link
          to={`/transactions/${t.id}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t.transaction_number}
        </Link>
      ),
    },
    { key: "date", header: "Tanggal", render: (t) => formatDate(t.transaction_date) },
    {
      key: "description",
      header: "Deskripsi",
      render: (t) => <span className="block max-w-64 truncate">{t.description}</span>,
    },
    {
      key: "category",
      header: "Kategori",
      render: (t) => t.category?.name ?? <span className="text-muted-foreground">-</span>,
    },
    {
      key: "wakif",
      header: isPenerimaan ? "Wakif" : "Penerima",
      render: (t) =>
        isPenerimaan
          ? (t.wakif?.name ?? <span className="text-muted-foreground">-</span>)
          : (t.recipient ?? <span className="text-muted-foreground">-</span>),
    },
    {
      key: "amount",
      header: "Jumlah",
      className: "text-right",
      render: (t) => (
        <Amount
          value={t.amount}
          colored={isPenerimaan ? "penerimaan" : "pengeluaran"}
        />
      ),
    },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
  ]

  const err = list.error instanceof Error ? list.error.message : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={isPenerimaan ? "Penerimaan Wakaf" : "Pengeluaran Wakaf"}
        description={
          isPenerimaan
            ? "Daftar seluruh transaksi penerimaan wakaf"
            : "Daftar seluruh transaksi pengeluaran dan penyaluran manfaat"
        }
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => navigate(`/${transactionType}/new`)}>
              <PlusIcon />
              {isPenerimaan ? "Catat Penerimaan" : "Catat Pengeluaran"}
            </Button>
          ) : null
        }
      />
      <DataTable<Transaction>
        title={isPenerimaan ? "Daftar Penerimaan" : "Daftar Pengeluaran"}
        description={`Total ${paginated.total} transaksi`}
        columns={columns}
        rows={paginated.items}
        rowKey={(t) => t.id}
        isLoading={list.isLoading}
        error={err}
        emptyTitle={isPenerimaan ? "Belum ada penerimaan" : "Belum ada pengeluaran"}
        emptyDescription={
          canCreate
            ? "Klik tombol catat untuk membuat transaksi baru."
            : "Belum ada transaksi yang tercatat."
        }
        onRowClick={(t) => navigate(`/transactions/${t.id}`)}
        searchPredicate={(t, q) => {
          const inq = q.toLowerCase()
          return (
            t.transaction_number.toLowerCase().includes(inq) ||
            t.description.toLowerCase().includes(inq)
          )
        }}
        searchPlaceholder="Cari nomor atau deskripsi..."
        page={paginated.page}
        totalPages={paginated.total_pages}
        total={paginated.total}
        onPageChange={setPage}
        toolbar={
          <>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as TransactionStatus | "all")
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v ?? "all")
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-48">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {normalizeList(categories.data).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
    </div>
  )
}
