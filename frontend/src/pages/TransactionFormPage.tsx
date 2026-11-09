import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon } from "lucide-react"
import { TransactionForm } from "@/components/shared/TransactionForm"
import { PageHeader } from "@/components/shared/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { transactionsApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import type { TransactionType } from "@/types"

interface TransactionFormPageProps {
  transactionType: TransactionType
}

export default function TransactionFormPage({ transactionType }: TransactionFormPageProps) {
  const { id } = useParams<{ id: string }>()
  const isEdit = id != null

  const existing = useQuery({
    queryKey: queryKeys.transaction(id ?? ""),
    queryFn: () => transactionsApi.get(id ?? ""),
    enabled: isEdit,
  })

  const title =
    transactionType === "penerimaan"
      ? isEdit
        ? "Edit Penerimaan Wakaf"
        : "Pencatatan Penerimaan Wakaf"
      : isEdit
        ? "Edit Pengeluaran Wakaf"
        : "Pencatatan Pengeluaran Wakaf"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader printable={false} title={title} backHref={`/${transactionType}`} />
      {isEdit ? (
        existing.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : existing.isError ? (
          <p className="text-sm text-destructive">Gagal memuat transaksi: {existing.error.message}</p>
        ) : (
          <TransactionForm transactionType={transactionType} existing={existing.data} />
        )
      ) : (
        <TransactionForm transactionType={transactionType} />
      )}
      {isEdit && existing.data ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeftIcon className="size-3" />
          Mengedit transaksi {existing.data.transaction_number} — status{" "}
          {existing.data.status}.
        </p>
      ) : null}
    </div>
  )
}
