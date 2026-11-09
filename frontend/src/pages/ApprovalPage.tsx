import { useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2Icon, ClipboardCheckIcon, EyeIcon, XCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { Amount } from "@/components/shared/Amount"
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldControl,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/auth/auth-context"
import { ApiClientError, normalizePaginated, transactionsApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate } from "@/lib/format"
import type { Transaction } from "@/types"

export default function ApprovalPage() {
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const canApprove = hasRole("admin", "pemeriksa")

  const [page, setPage] = useState(1)
  const [action, setAction] = useState<"approve" | "reject" | null>(null)
  const [target, setTarget] = useState<Transaction | null>(null)
  const [note, setNote] = useState("")
  const [noteError, setNoteError] = useState<string | null>(null)

  const list = useQuery({
    queryKey: queryKeys.transactions({ status: "menunggu_persetujuan", page, limit: 10 }),
    queryFn: () => transactionsApi.list({ status: "menunggu_persetujuan", page, limit: 10 }),
  })

  const paginated = normalizePaginated(list.data, page, 10)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }

  const approveMutation = useMutation({
    mutationFn: (tx: Transaction) =>
      transactionsApi.approve(tx.id, note.trim() ? note.trim() : undefined),
    onSuccess: () => {
      toast.success("Transaksi disetujui")
      closeDialog()
      invalidate()
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Gagal menyetujui"),
  })

  const rejectMutation = useMutation({
    mutationFn: (tx: Transaction) => transactionsApi.reject(tx.id, note),
    onSuccess: () => {
      toast.success("Transaksi ditolak")
      closeDialog()
      invalidate()
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : "Gagal menolak"),
  })

  const closeDialog = () => {
    setAction(null)
    setTarget(null)
    setNote("")
    setNoteError(null)
  }

  const openDialog = (tx: Transaction, kind: "approve" | "reject") => {
    setTarget(tx)
    setAction(kind)
    setNote("")
    setNoteError(null)
  }

  const confirmAction = () => {
    if (!target) return
    if (action === "reject" && note.trim().length < 3) {
      setNoteError("Catatan penolakan minimal 3 karakter")
      return
    }
    if (action === "reject") rejectMutation.mutate(target)
    else approveMutation.mutate(target)
  }

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
      key: "type",
      header: "Jenis",
      render: (t) => (
        <span className="capitalize">{t.transaction_type}</span>
      ),
    },
    {
      key: "description",
      header: "Deskripsi",
      render: (t) => <span className="block max-w-64 truncate">{t.description}</span>,
    },
    {
      key: "submitted-by",
      header: "Diajukan Oleh",
      render: (t) => t.created_by_name ?? "-",
    },
    {
      key: "amount",
      header: "Jumlah",
      className: "text-right",
      render: (t) => (
        <Amount
          value={t.amount}
          colored={t.transaction_type === "penerimaan" ? "penerimaan" : "pengeluaran"}
        />
      ),
    },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
    {
      key: "actions",
      header: "Aksi",
      className: "text-right",
      render: (t) =>
        canApprove ? (
          <div className="flex justify-end gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Lihat detail"
              onClick={(e) => {
                e.stopPropagation()
                window.location.assign(`/transactions/${t.id}`)
              }}
            >
              <EyeIcon />
            </Button>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                openDialog(t, "approve")
              }}
              disabled={approveMutation.isPending}
            >
              <CheckCircle2Icon />Setujui
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation()
                openDialog(t, "reject")
              }}
              disabled={rejectMutation.isPending}
            >
              <XCircleIcon />Tolak
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Hanya lihat</span>
        ),
    },
  ]

  const err = list.error instanceof Error ? list.error.message : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Persetujuan Transaksi"
        description="Transaksi yang menunggu persetujuan pemeriksa"
      />
      <DataTable<Transaction>
        title="Menunggu Persetujuan"
        description={`Total ${paginated.total} transaksi menunggu persetujuan`}
        columns={columns}
        rows={paginated.items}
        rowKey={(t) => t.id}
        isLoading={list.isLoading}
        error={err}
        emptyTitle="Tidak ada transaksi menunggu persetujuan"
        emptyDescription="Semua transaksi telah diproses."
        onRowClick={(t) => window.location.assign(`/transactions/${t.id}`)}
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
      />

      <Dialog open={action !== null} onOpenChange={(open) => (open ? null : closeDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Setujui Transaksi" : "Tolak Transaksi"}
            </DialogTitle>
            <DialogDescription>
              {target
                ? `${target.transaction_number} — ${target.description}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={noteError ? true : undefined}>
            <FieldLabel htmlFor="approval-note">
              {action === "approve" ? "Catatan (opsional)" : "Catatan Penolakan"}
            </FieldLabel>
            <FieldControl>
              <Textarea
                id="approval-note"
                rows={3}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value)
                  setNoteError(null)
                }}
                placeholder={
                  action === "approve"
                    ? "Catatan persetujuan..."
                    : "Alasan penolakan (wajib)..."
                }
              />
            </FieldControl>
            {noteError ? <FieldError>{noteError}</FieldError> : null}
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Batal
            </Button>
            <Button
              variant={action === "reject" ? "destructive" : "default"}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              onClick={confirmAction}
            >
              <ClipboardCheckIcon />
              {action === "approve" ? "Setujui" : "Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
