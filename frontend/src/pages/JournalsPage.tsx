import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable"
import { journalsApi, normalizePaginated } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate } from "@/lib/format"
import type { Journal } from "@/types"

export default function JournalsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const list = useQuery({
    queryKey: queryKeys.journals({ page, limit: 10 }),
    queryFn: () => journalsApi.list({ page, limit: 10 }),
  })

  const paginated = normalizePaginated(list.data, page, 10)

  const columns: DataTableColumn<Journal>[] = [
    {
      key: "number",
      header: "Nomor Jurnal",
      render: (j) => (
        <Link
          to={`/journals/${j.id}`}
          className="font-mono text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {j.journal_number}
        </Link>
      ),
    },
    { key: "date", header: "Tanggal", render: (j) => formatDate(j.entry_date ?? j.journal_date) },
    {
      key: "description",
      header: "Deskripsi",
      render: (j) => <span className="block max-w-64 truncate">{j.description ?? "-"}</span>,
    },
    {
      key: "source",
      header: "Sumber",
      render: (j) => <span className="text-muted-foreground">{j.source ?? "Manual"}</span>,
    },
    {
      key: "lines",
      header: "Baris",
      render: (j) => (
        <span className="tabular-nums">{j.lines?.length ?? 0}</span>
      ),
    },
  ]

  const err = list.error instanceof Error ? list.error.message : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Jurnal Umum"
        description="Daftar jurnal keuangan (dibuat otomatis dari posting transaksi)"
      />
      <DataTable<Journal>
        title="Daftar Jurnal"
        description={`Total ${paginated.total} jurnal`}
        columns={columns}
        rows={paginated.items}
        rowKey={(j) => j.id}
        isLoading={list.isLoading}
        error={err}
        emptyTitle="Belum ada jurnal"
        emptyDescription="Jurnal dibuat saat transaksi diposting."
        onRowClick={(j) => navigate(`/journals/${j.id}`)}
        searchPredicate={(j, q) => {
          const inq = q.toLowerCase()
          return (
            j.journal_number.toLowerCase().includes(inq) ||
            (j.description ?? "").toLowerCase().includes(inq)
          )
        }}
        searchPlaceholder="Cari nomor jurnal..."
        page={paginated.page}
        totalPages={paginated.total_pages}
        total={paginated.total}
        onPageChange={setPage}
      />
    </div>
  )
}
