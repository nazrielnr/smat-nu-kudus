import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import { PencilIcon, PlusIcon, UserPlusIcon } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { ApiClientError, normalizePaginated, wakifApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate } from "@/lib/format"
import { useAuth } from "@/auth/auth-context"
import type { Wakif } from "@/types"

const wakifSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  nik: z
    .string()
    .refine((v) => v === "" || /^\d{16}$/.test(v), "NIK harus 16 digit angka"),
  phone: z
    .string()
    .refine((v) => v === "" || /^[\d+\-\s()]{6,20}$/.test(v), "Nomor telepon tidak valid"),
  email: z
    .string()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Format email tidak valid"),
  address: z.string().max(500, "Alamat maksimal 500 karakter"),
})

type WakifForm = z.infer<typeof wakifSchema>

function emptyForm(): WakifForm {
  return { name: "", nik: "", phone: "", email: "", address: "" }
}

function toForm(w: Wakif): WakifForm {
  return {
    name: w.name ?? "",
    nik: w.nik ?? "",
    phone: w.phone ?? "",
    email: w.email ?? "",
    address: w.address ?? "",
  }
}

export default function WakifListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const canEdit = hasRole("admin", "bendahara")

  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Wakif | null>(null)

  const list = useQuery({
    queryKey: queryKeys.wakif({ page, limit: 10 }),
    queryFn: () => wakifApi.list({ page, limit: 10 }),
  })

  const paginated = normalizePaginated(list.data, page, 10)

  const form = useForm<WakifForm>({
    resolver: zodResolver(wakifSchema),
    defaultValues: emptyForm(),
  })

  const saveMutation = useMutation({
    mutationFn: async (values: WakifForm) => {
      const payload = {
        name: values.name,
        nik: values.nik || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address || undefined,
      }
      if (editing) return wakifApi.update(editing.id, payload)
      return wakifApi.create(payload)
    },
    onSuccess: () => {
      toast.success(editing ? "Wakif berhasil diperbarui" : "Wakif berhasil ditambahkan")
      queryClient.invalidateQueries({ queryKey: ["wakif"] })
      setDialogOpen(false)
      setEditing(null)
      form.reset(emptyForm())
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal menyimpan wakif")
    },
  })

  const openCreate = () => {
    setEditing(null)
    form.reset(emptyForm())
    setDialogOpen(true)
  }

  const openEdit = (w: Wakif) => {
    setEditing(w)
    form.reset(toForm(w))
    setDialogOpen(true)
  }

  const columns: DataTableColumn<Wakif>[] = [
    {
      key: "name",
      header: "Nama",
      render: (w) => <span className="font-medium">{w.name}</span>,
    },
    { key: "nik", header: "NIK", render: (w) => w.nik ?? "-" },
    { key: "phone", header: "Telepon", render: (w) => w.phone ?? "-" },
    { key: "email", header: "Email", render: (w) => w.email ?? "-" },
    { key: "created", header: "Terdaftar", render: (w) => formatDate(w.created_at) },
  ]

  const err = list.error instanceof Error ? list.error.message : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Wakif"
        description="Daftar pemberi wakaf (wakif) terdaftar"
        actions={
          canEdit ? (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open)
                if (!open) {
                  setEditing(null)
                  form.reset(emptyForm())
                }
              }}
            >
              <DialogTrigger asChild>
              <Button onClick={openCreate}><PlusIcon />Tambah Wakif</Button>
            </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Wakif" : "Tambah Wakif"}</DialogTitle>
                  <DialogDescription>
                    {editing
                      ? "Perbarui data wakif berikut."
                      : "Lengkapi data wakif baru."}
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
                  className="flex flex-col gap-1"
                  noValidate
                >
                  <FieldGroup>
                    <Field data-invalid={form.formState.errors.name ? true : undefined}>
                      <FieldLabel htmlFor="wakif-name">Nama Lengkap</FieldLabel>
                      <FieldControl>
                        <Input id="wakif-name" placeholder="Nama wakif" {...form.register("name")} />
                      </FieldControl>
                      {form.formState.errors.name ? (
                        <FieldError errors={[{ message: form.formState.errors.name.message }]} />
                      ) : null}
                    </Field>
                    <Field data-invalid={form.formState.errors.nik ? true : undefined}>
                      <FieldLabel htmlFor="wakif-nik">NIK</FieldLabel>
                      <FieldControl>
                        <Input id="wakif-nik" placeholder="16 digit" inputMode="numeric" {...form.register("nik")} />
                      </FieldControl>
                      <FieldDescription>Kosongkan bila tidak ada.</FieldDescription>
                      {form.formState.errors.nik ? (
                        <FieldError errors={[{ message: form.formState.errors.nik.message }]} />
                      ) : null}
                    </Field>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Field data-invalid={form.formState.errors.phone ? true : undefined}>
                        <FieldLabel htmlFor="wakif-phone">Telepon</FieldLabel>
                        <FieldControl>
                          <Input id="wakif-phone" placeholder="08xxxxxxxxxx" {...form.register("phone")} />
                        </FieldControl>
                        {form.formState.errors.phone ? (
                          <FieldError errors={[{ message: form.formState.errors.phone.message }]} />
                        ) : null}
                      </Field>
                      <Field data-invalid={form.formState.errors.email ? true : undefined}>
                        <FieldLabel htmlFor="wakif-email">Email</FieldLabel>
                        <FieldControl>
                          <Input id="wakif-email" type="email" placeholder="email@contoh.id" {...form.register("email")} />
                        </FieldControl>
                        {form.formState.errors.email ? (
                          <FieldError errors={[{ message: form.formState.errors.email.message }]} />
                        ) : null}
                      </Field>
                    </div>
                    <Field data-invalid={form.formState.errors.address ? true : undefined}>
                      <FieldLabel htmlFor="wakif-address">Alamat</FieldLabel>
                      <FieldControl>
                        <Textarea id="wakif-address" placeholder="Alamat lengkap" rows={2} {...form.register("address")} />
                      </FieldControl>
                      {form.formState.errors.address ? (
                        <FieldError errors={[{ message: form.formState.errors.address.message }]} />
                      ) : null}
                    </Field>
                  </FieldGroup>
                  <DialogFooter className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Batal
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      <UserPlusIcon />
                      {editing ? "Simpan Perubahan" : "Simpan"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />
      <DataTable<Wakif>
        columns={columns}
        rows={paginated.items}
        rowKey={(w) => w.id}
        isLoading={list.isLoading}
        error={err}
        emptyTitle="Belum ada wakif"
        emptyDescription="Tambahkan wakif untuk mulai mencatat transaksi wakaf."
        onRowClick={(w) => navigate(`/wakif/${w.id}`)}
        searchPredicate={(w, q) =>
          w.name.toLowerCase().includes(q) || (w.nik ?? "").includes(q)
        }
        searchPlaceholder="Cari nama atau NIK..."
        page={paginated.page}
        totalPages={paginated.total_pages}
        total={paginated.total}
        onPageChange={setPage}
        title="Daftar Wakif"
        description={`Total ${paginated.total} wakif terdaftar`}
        toolbar={
          canEdit ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (paginated.items.length > 0) openEdit(paginated.items[0])
              }}
              className="hidden"
            >
              <PencilIcon />Edit
            </Button>
          ) : null
        }
      />
    </div>
  )
}
