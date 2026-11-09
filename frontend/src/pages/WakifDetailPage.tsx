import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import { ArrowLeftIcon, PencilIcon, SaveIcon } from "lucide-react"
import { Amount } from "@/components/shared/Amount"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/auth/auth-context"
import { ApiClientError, normalizeList, wakifApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate } from "@/lib/format"

const wakifSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  nik: z.string().refine((v) => v === "" || /^\d{16}$/.test(v), "NIK harus 16 digit angka"),
  phone: z
    .string()
    .refine((v) => v === "" || /^[\d+\-\s()]{6,20}$/.test(v), "Nomor telepon tidak valid"),
  email: z
    .string()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Format email tidak valid"),
  address: z.string().max(500, "Alamat maksimal 500 karakter"),
})

type WakifForm = z.infer<typeof wakifSchema>

export default function WakifDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const canEdit = hasRole("admin", "bendahara")

  const [dialogOpen, setDialogOpen] = useState(false)

  const detail = useQuery({
    queryKey: queryKeys.wakifDetail(id ?? ""),
    queryFn: () => wakifApi.get(id ?? ""),
    enabled: id != null,
  })

  const transactions = useQuery({
    queryKey: queryKeys.wakifTransactions(id ?? ""),
    queryFn: () => wakifApi.transactions(id ?? "", { limit: 50 }),
    enabled: id != null,
  })

  const form = useForm<WakifForm>({
    resolver: zodResolver(wakifSchema),
    defaultValues: { name: "", nik: "", phone: "", email: "", address: "" },
  })

  const saveMutation = useMutation({
    mutationFn: (values: WakifForm) =>
      wakifApi.update(id ?? "", {
        name: values.name,
        nik: values.nik || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address || undefined,
      }),
    onSuccess: () => {
      toast.success("Data wakif diperbarui")
      queryClient.invalidateQueries({ queryKey: ["wakif"] })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal menyimpan")
    },
  })

  if (!id) return null

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (detail.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate("/wakif")} className="w-fit">
          <ArrowLeftIcon />Kembali
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            Gagal memuat data wakif: {detail.error.message}
          </CardContent>
        </Card>
      </div>
    )
  }

  const w = detail.data!
  const txItems = normalizeList(transactions.data)
  const totalPenerimaan = txItems
    .filter((t) => t.transaction_type === "penerimaan")
    .reduce((acc, t) => acc + t.amount, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={w.name}
        description="Detail wakif dan riwayat transaksinya"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("/wakif")}>
              <ArrowLeftIcon />Kembali
            </Button>
            {canEdit ? (
              <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open)
                  if (open) {
                    form.reset({
                      name: w.name ?? "",
                      nik: w.nik ?? "",
                      phone: w.phone ?? "",
                      email: w.email ?? "",
                      address: w.address ?? "",
                    })
                  }
                }}
              >
                <DialogTrigger asChild>
              <Button size="sm"><PencilIcon />Edit</Button>
            </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Wakif</DialogTitle>
                    <DialogDescription>Perbarui data wakif ini.</DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
                    className="flex flex-col gap-1"
                    noValidate
                  >
                    <FieldGroup>
                      <Field data-invalid={form.formState.errors.name ? true : undefined}>
                        <FieldLabel htmlFor="w-name">Nama Lengkap</FieldLabel>
                        <FieldControl>
                          <Input id="w-name" {...form.register("name")} />
                        </FieldControl>
                        {form.formState.errors.name ? (
                          <FieldError errors={[{ message: form.formState.errors.name.message }]} />
                        ) : null}
                      </Field>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Field data-invalid={form.formState.errors.nik ? true : undefined}>
                          <FieldLabel htmlFor="w-nik">NIK</FieldLabel>
                          <FieldControl>
                            <Input id="w-nik" inputMode="numeric" {...form.register("nik")} />
                          </FieldControl>
                          <FieldDescription>Kosongkan bila tidak ada.</FieldDescription>
                          {form.formState.errors.nik ? (
                            <FieldError errors={[{ message: form.formState.errors.nik.message }]} />
                          ) : null}
                        </Field>
                        <Field data-invalid={form.formState.errors.phone ? true : undefined}>
                          <FieldLabel htmlFor="w-phone">Telepon</FieldLabel>
                          <FieldControl>
                            <Input id="w-phone" {...form.register("phone")} />
                          </FieldControl>
                          {form.formState.errors.phone ? (
                            <FieldError errors={[{ message: form.formState.errors.phone.message }]} />
                          ) : null}
                        </Field>
                      </div>
                      <Field data-invalid={form.formState.errors.email ? true : undefined}>
                        <FieldLabel htmlFor="w-email">Email</FieldLabel>
                        <FieldControl>
                          <Input id="w-email" type="email" {...form.register("email")} />
                        </FieldControl>
                        {form.formState.errors.email ? (
                          <FieldError errors={[{ message: form.formState.errors.email.message }]} />
                        ) : null}
                      </Field>
                      <Field data-invalid={form.formState.errors.address ? true : undefined}>
                        <FieldLabel htmlFor="w-address">Alamat</FieldLabel>
                        <FieldControl>
                          <Textarea id="w-address" rows={2} {...form.register("address")} />
                        </FieldControl>
                        {form.formState.errors.address ? (
                          <FieldError errors={[{ message: form.formState.errors.address.message }]} />
                        ) : null}
                      </Field>
                    </FieldGroup>
                    <DialogFooter className="mt-4">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Batal
                      </Button>
                      <Button type="submit" disabled={saveMutation.isPending}>
                        <SaveIcon />Simpan
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Informasi Wakif</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">NIK</dt>
                <dd className="text-sm font-medium">{w.nik ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Telepon</dt>
                <dd className="text-sm font-medium">{w.phone ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="text-sm font-medium">{w.email ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Terdaftar Sejak</dt>
                <dd className="text-sm font-medium">{formatDate(w.created_at)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Alamat</dt>
                <dd className="text-sm font-medium">{w.address ?? "-"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Penerimaan</CardTitle>
            <CardDescription>Seluruh transaksi penerimaan wakif ini</CardDescription>
          </CardHeader>
          <CardContent>
            <Amount value={totalPenerimaan} colored="penerimaan" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Transaksi</CardTitle>
          <CardDescription>Transaksi yang terkait dengan wakif ini</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : txItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Belum ada transaksi untuk wakif ini.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txItems.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        to={`/transactions/${t.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {t.transaction_number}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(t.transaction_date)}</TableCell>
                    <TableCell className="capitalize">{t.transaction_type}</TableCell>
                    <TableCell className="max-w-64 truncate">{t.description}</TableCell>
                    <TableCell className="text-right">
                      <Amount
                        value={t.amount}
                        colored={t.transaction_type === "penerimaan" ? "penerimaan" : "pengeluaran"}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
