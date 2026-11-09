import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftIcon, BookOpenCheckIcon } from "lucide-react"
import { toast } from "sonner"
import { Amount } from "@/components/shared/Amount"
import { PageHeader } from "@/components/shared/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { useAuth } from "@/auth/auth-context"
import { ApiClientError, journalsApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate, formatDateTime } from "@/lib/format"

export default function JournalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const canPost = hasRole("admin", "bendahara")

  const [posting, setPosting] = useState(false)

  const detail = useQuery({
    queryKey: queryKeys.journal(id ?? ""),
    queryFn: () => journalsApi.get(id ?? ""),
    enabled: id != null,
  })

  const postMutation = useMutation({
    mutationFn: () => journalsApi.post(id ?? ""),
    onSuccess: () => {
      toast.success("Jurnal berhasil diposting")
      queryClient.invalidateQueries({ queryKey: ["journals"] })
      queryClient.invalidateQueries({ queryKey: ["ledger"] })
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] })
      if (id) queryClient.invalidateQueries({ queryKey: queryKeys.journal(id) })
      setPosting(false)
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal memposting jurnal")
      setPosting(false)
    },
  })

  if (!id) return null

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (detail.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate("/journals")} className="w-fit">
          <ArrowLeftIcon />Kembali
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            Gagal memuat jurnal: {detail.error.message}
          </CardContent>
        </Card>
      </div>
    )
  }

  const j = detail.data!
  const totalDebit = j.lines.reduce((acc, l) => acc + (l.debit ?? 0), 0)
  const totalCredit = j.lines.reduce((acc, l) => acc + (l.credit ?? 0), 0)
  const isPosted = j.status === "posted" || j.posted_at != null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={j.journal_number}
        description={j.description ?? "Jurnal umum"}
        backHref="/journals"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={isPosted ? "default" : "secondary"}>
              {isPosted ? "Diposting" : "Draft"}
            </Badge>
            {canPost && !isPosted ? (
              <Button
                size="sm"
                disabled={posting}
                onClick={() => {
                  setPosting(true)
                  postMutation.mutate()
                }}
              >
                <BookOpenCheckIcon />
                Posting Jurnal
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Detail Jurnal</CardTitle>
          <CardDescription>
            Tanggal {formatDate(j.entry_date ?? j.journal_date)}
            {j.source ? ` · Sumber: ${j.source}` : ""}
            {isPosted && j.posted_at ? ` · Diposting ${formatDateTime(j.posted_at)}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {j.lines.length === 0 ? (
            <Empty className="min-h-32">
              <EmptyHeader>
                <EmptyTitle>Jurnal belum memiliki baris</EmptyTitle>
                <EmptyDescription>Baris jurnal debit/kredit akan tampil di sini.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Kode</TableHead>
                  <TableHead>Nama Akun</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Kredit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {j.lines.map((line, idx) => (
                  <TableRow key={line.id ?? idx}>
                    <TableCell className="font-mono text-sm">
                      {line.account_code ?? line.account_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">{line.account_name ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {line.description ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {line.debit > 0 ? <Amount value={line.debit} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {line.credit > 0 ? <Amount value={line.credit} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right">
                    <Amount value={totalDebit} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Amount value={totalCredit} />
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
          <p className="pt-2 text-xs text-muted-foreground">
            {totalDebit === totalCredit
              ? "Jurnal seimbang (debit = kredit)."
              : "Peringatan: jurnal tidak seimbang."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
