import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BanIcon,
  CheckCircle2Icon,
  PaperclipIcon,
  PencilIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Amount } from "@/components/shared/Amount"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge, statusLabel } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/auth/auth-context"
import { ApiClientError, transactionsApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate, formatDateTime } from "@/lib/format"
import type { TransactionStatus } from "@/types"

// Status timeline: order of the happy path plus terminal states.
const TIMELINE: TransactionStatus[] = [
  "draft",
  "menunggu_persetujuan",
  "disetujui",
  "diposting",
]

const TERMINAL_BAD: TransactionStatus[] = ["ditolak", "dibatalkan"]

function Timeline({ status, approvedAt, postedAt, rejectedAt }: {
  status: TransactionStatus
  approvedAt?: string | null
  postedAt?: string | null
  rejectedAt?: string | null
}) {
  const currentIndex = TIMELINE.indexOf(status)
  const rejected = status === "ditolak"
  const cancelled = status === "dibatalkan"
  const times: Partial<Record<TransactionStatus, string | null>> = {
    disetujui: approvedAt ?? undefined,
    diposting: postedAt ?? undefined,
    ditolak: rejectedAt ?? undefined,
  }

  return (
    <ol className="flex flex-col gap-0">
      {TIMELINE.map((step, idx) => {
        const done = currentIndex >= idx && currentIndex !== -1
        const active = currentIndex === idx
        const stamp = times[step]
        return (
          <li key={step} className="relative flex gap-3 pb-6 last:pb-0">
            {idx < TIMELINE.length - 1 ? (
              <span
                className={`absolute top-4 left-[7px] h-full w-px ${done ? "bg-primary" : "bg-border"}`}
                aria-hidden
              />
            ) : null}
            <span
              className={`relative z-10 mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
                done ? "border-primary bg-primary" : "border-border bg-background"
              } ${active ? "ring-3 ring-primary/30" : ""}`}
            >
              {done ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                {statusLabel(step)}
              </span>
              {stamp ? (
                <span className="text-xs text-muted-foreground">{formatDateTime(stamp)}</span>
              ) : null}
            </div>
          </li>
        )
      })}
      {rejected || cancelled ? (
        <li className="flex items-center gap-3">
          <span
            className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
              rejected ? "border-red-500 bg-red-500" : "border-muted-foreground bg-muted-foreground"
            }`}
          />
          <span className={`text-sm font-medium ${rejected ? "text-red-600" : "text-muted-foreground"}`}>
            {statusLabel(status)}
            {rejected && rejectedAt ? ` — ${formatDateTime(rejectedAt)}` : ""}
          </span>
        </li>
      ) : null}
    </ol>
  )
}

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const canEdit = hasRole("admin", "bendahara")
  const canApprove = hasRole("admin", "pemeriksa")
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState("")
  const [noteError, setNoteError] = useState<string | null>(null)

  const detail = useQuery({
    queryKey: queryKeys.transaction(id ?? ""),
    queryFn: () => transactionsApi.get(id ?? ""),
    enabled: id != null,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    if (id) queryClient.invalidateQueries({ queryKey: queryKeys.transaction(id) })
  }

  const handleErr = (err: unknown, fallback: string) =>
    toast.error(err instanceof ApiClientError ? err.message : fallback)

  const submitMutation = useMutation({
    mutationFn: () => transactionsApi.submit(id ?? ""),
    onSuccess: () => {
      toast.success("Transaksi diajukan untuk persetujuan")
      invalidate()
    },
    onError: (e) => handleErr(e, "Gagal mengajukan transaksi"),
  })

  const approveMutation = useMutation({
    mutationFn: () => transactionsApi.approve(id ?? ""),
    onSuccess: () => {
      toast.success("Transaksi disetujui")
      invalidate()
    },
    onError: (e) => handleErr(e, "Gagal menyetujui transaksi"),
  })

  const rejectMutation = useMutation({
    mutationFn: () => transactionsApi.reject(id ?? "", rejectNote),
    onSuccess: () => {
      toast.success("Transaksi ditolak")
      setRejectOpen(false)
      setRejectNote("")
      invalidate()
    },
    onError: (e) => handleErr(e, "Gagal menolak transaksi"),
  })

  const postMutation = useMutation({
    mutationFn: () => transactionsApi.post(id ?? ""),
    onSuccess: () => {
      toast.success("Transaksi diposting ke jurnal")
      invalidate()
    },
    onError: (e) => handleErr(e, "Gagal memposting transaksi"),
  })

  const reverseMutation = useMutation({
    mutationFn: () => transactionsApi.reverse(id ?? ""),
    onSuccess: () => {
      toast.success("Transaksi dibatalkan (jurnal balik dibuat)")
      invalidate()
    },
    onError: (e) => handleErr(e, "Gagal membatalkan transaksi"),
  })

  if (!id) return null

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (detail.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="w-fit">
          <ArrowLeftIcon />Kembali
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            Gagal memuat transaksi: {detail.error.message}
          </CardContent>
        </Card>
      </div>
    )
  }

  const t = detail.data!
  const isPenerimaan = t.transaction_type === "penerimaan"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.transaction_number}
        description={`${isPenerimaan ? "Penerimaan" : "Pengeluaran"} wakaf — ${t.description}`}
        backHref={isPenerimaan ? "/penerimaan" : "/pengeluaran"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            {canEdit && t.status === "draft" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/${t.transaction_type}/${t.id}/edit`,
                    )
                  }
                >
                  <PencilIcon />Edit
                </Button>
                <Button size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                  <SendIcon />Ajukan
                </Button>
              </>
            ) : null}
            {canApprove && t.status === "menunggu_persetujuan" ? (
              <>
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2Icon />Setujui
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setRejectOpen(true)}
                  disabled={rejectMutation.isPending}
                >
                  <XCircleIcon />Tolak
                </Button>
              </>
            ) : null}
            {canEdit && t.status === "disetujui" ? (
              <Button size="sm" onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
                Posting ke Jurnal
              </Button>
            ) : null}
            {canEdit && t.status === "diposting" ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => reverseMutation.mutate()}
                disabled={reverseMutation.isPending}
              >
                <BanIcon />Batalkan (Jurnal Balik)
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Detail Transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Jenis</dt>
                <dd className="text-sm font-medium capitalize">{t.transaction_type}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tanggal</dt>
                <dd className="text-sm font-medium">{formatDate(t.transaction_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Kategori</dt>
                <dd className="text-sm font-medium">{t.category?.name ?? t.category_id}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Jumlah</dt>
                <dd className="text-sm font-medium">
                  <Amount
                    value={t.amount}
                    colored={isPenerimaan ? "penerimaan" : "pengeluaran"}
                  />
                </dd>
              </div>
              {isPenerimaan ? (
                <>
                  <div>
                    <dt className="text-xs text-muted-foreground">Wakif</dt>
                    <dd className="text-sm font-medium">
                      {t.wakif ? (
                        <Link
                          to={`/wakif/${t.wakif.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {t.wakif.name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Metode Pembayaran</dt>
                    <dd className="text-sm font-medium capitalize">{t.payment_method ?? "-"}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt className="text-xs text-muted-foreground">Penerima</dt>
                    <dd className="text-sm font-medium">{t.recipient ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Sumber Dana</dt>
                    <dd className="text-sm font-medium">{t.source_of_funds ?? "-"}</dd>
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Deskripsi</dt>
                <dd className="text-sm">{t.description}</dd>
              </div>
              {t.attachment_url ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Lampiran</dt>
                  <dd className="text-sm">
                    <a
                      href={t.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    >
                      <PaperclipIcon className="size-3" />
                      Lihat lampiran
                    </a>
                  </dd>
                </div>
              ) : null}
              {t.rejection_note ?? t.rejection_reason ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Catatan Penolakan</dt>
                  <dd className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {t.rejection_note ?? t.rejection_reason}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-muted-foreground">Dibuat Oleh</dt>
                <dd className="text-sm font-medium">{t.created_by_name ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Jurnal Terkait</dt>
                <dd className="text-sm font-medium">
                  {t.journal_id ? (
                    <Link
                      to={`/journals/${t.journal_id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Lihat jurnal
                    </Link>
                  ) : (
                    "Belum diposting"
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Transaksi</CardTitle>
            <CardDescription>Alur persetujuan dan posting</CardDescription>
          </CardHeader>
          <CardContent>
            <Timeline
              status={t.status}
              approvedAt={t.approved_at}
              postedAt={t.posted_at}
              rejectedAt={t.status === "ditolak" ? t.updated_at : undefined}
            />
            {TERMINAL_BAD.includes(t.status) ? null : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Transaksi</DialogTitle>
            <DialogDescription>
              Berikan catatan penolakan untuk {t.transaction_number}.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={noteError ? true : undefined}>
            <FieldLabel htmlFor="reject-note">Catatan Penolakan</FieldLabel>
            <FieldControl>
              <Textarea
                id="reject-note"
                rows={3}
                value={rejectNote}
                onChange={(e) => {
                  setRejectNote(e.target.value)
                  setNoteError(null)
                }}
                placeholder="Alasan penolakan..."
              />
            </FieldControl>
            {noteError ? <FieldError>{noteError}</FieldError> : null}
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() => {
                if (rejectNote.trim().length < 3) {
                  setNoteError("Catatan minimal 3 karakter")
                  return
                }
                rejectMutation.mutate()
              }}
            >
              Tolak Transaksi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
