import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, PlusIcon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable"
import { roleLabel } from "@/components/layout/Header"
import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ApiClientError, normalizePaginated, usersApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate } from "@/lib/format"
import type { Role, User } from "@/types"

const ROLES: Role[] = ["admin", "bendahara", "pengelola_aset", "pemeriksa", "pimpinan"]

const schema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  role: z.enum(["admin", "bendahara", "pengelola_aset", "pemeriksa", "pimpinan"], {
    message: "Peran wajib dipilih",
  }),
  password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter")
    .regex(/[A-Z]/, "Harus mengandung huruf kapital")
    .regex(/[0-9]/, "Harus mengandung angka")
    .regex(/[^A-Za-z0-9]/, "Harus mengandung karakter khusus"),
})

type FormValues = z.infer<typeof schema>

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)

  const list = useQuery({
    queryKey: queryKeys.users({ page, limit: 10 }),
    queryFn: () => usersApi.list({ page, limit: 10 }),
  })

  const paginated = normalizePaginated(list.data, page, 10)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", role: "bendahara", password: "" },
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      usersApi.create({
        name: values.name,
        email: values.email,
        role: values.role,
        password: values.password,
        status: "aktif",
      }),
    onSuccess: () => {
      toast.success("Pengguna berhasil ditambahkan")
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setDialogOpen(false)
      form.reset({ name: "", email: "", role: "bendahara", password: "" })
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal menambahkan pengguna")
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ user, status }: { user: User; status: "aktif" | "nonaktif" }) =>
      usersApi.setStatus(user.id, status),
    onSuccess: () => {
      toast.success("Status pengguna diperbarui")
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal memperbarui status")
    },
  })

  const columns: DataTableColumn<User>[] = [
    {
      key: "name",
      header: "Nama",
      render: (u) => <span className="font-medium">{u.name}</span>,
    },
    { key: "email", header: "Email", render: (u) => u.email },
    {
      key: "role",
      header: "Peran",
      render: (u) => <Badge variant="secondary">{roleLabel(u.role)}</Badge>,
    },
    { key: "created", header: "Dibuat", render: (u) => formatDate(u.created_at) },
    {
      key: "status",
      header: "Status",
      render: (u) =>
        u.status === "nonaktif" ? (
          <Badge variant="destructive">Nonaktif</Badge>
        ) : (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Aktif
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "Aksi",
      className: "text-right",
      render: (u) => (
        <div className="flex items-center justify-end gap-2">
          <Switch
            checked={u.status !== "nonaktif"}
            onCheckedChange={(checked) =>
              statusMutation.mutate({ user: u, status: checked ? "aktif" : "nonaktif" })
            }
          />
          <span className="text-xs text-muted-foreground">
            {u.status !== "nonaktif" ? "Aktif" : "Nonaktif"}
          </span>
        </div>
      ),
    },
  ]

  const err = list.error instanceof Error ? list.error.message : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengguna"
        description="Kelola pengguna sistem dan perannya (khusus admin)"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                  <PlusIcon />
                  Tambah Pengguna
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Pengguna</DialogTitle>
                <DialogDescription>Pengguna baru dengan peran dan kata sandi awal.</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
                className="flex flex-col gap-1"
                noValidate
              >
                <FieldGroup>
                  <Field data-invalid={form.formState.errors.name ? true : undefined}>
                    <FieldLabel htmlFor="user-name">Nama</FieldLabel>
                    <FieldControl>
                      <Input id="user-name" placeholder="Nama lengkap" {...form.register("name")} />
                    </FieldControl>
                    {form.formState.errors.name ? (
                      <FieldError errors={[{ message: form.formState.errors.name.message }]} />
                    ) : null}
                  </Field>
                  <Field data-invalid={form.formState.errors.email ? true : undefined}>
                    <FieldLabel htmlFor="user-email">Email</FieldLabel>
                    <FieldControl>
                      <Input
                        id="user-email"
                        type="email"
                        placeholder="nama@nu-kudus.id"
                        {...form.register("email")}
                      />
                    </FieldControl>
                    {form.formState.errors.email ? (
                      <FieldError errors={[{ message: form.formState.errors.email.message }]} />
                    ) : null}
                  </Field>
                  <Field data-invalid={form.formState.errors.role ? true : undefined}>
                    <FieldLabel>Peran</FieldLabel>
                    <FieldControl>
                      <Controller
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Pilih peran" />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {roleLabel(r)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </FieldControl>
                    {form.formState.errors.role ? (
                      <FieldError errors={[{ message: form.formState.errors.role.message }]} />
                    ) : null}
                  </Field>
                  <Field data-invalid={form.formState.errors.password ? true : undefined}>
                    <FieldLabel htmlFor="user-password">Kata Sandi Awal</FieldLabel>
                    <FieldControl>
                      <Input
                        id="user-password"
                        type="password"
                        placeholder="Minimal 8 karakter, kapital+angka+simbol"
                        {...form.register("password")}
                      />
                    </FieldControl>
                    <FieldDescription>Contoh: Password123!</FieldDescription>
                    {form.formState.errors.password ? (
                      <FieldError errors={[{ message: form.formState.errors.password.message }]} />
                    ) : null}
                  </Field>
                </FieldGroup>
                <DialogFooter className="mt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <UserPlusIcon />
                    )}
                    Simpan
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <DataTable<User>
        title="Daftar Pengguna"
        description={`Total ${paginated.total} pengguna`}
        columns={columns}
        rows={paginated.items}
        rowKey={(u) => u.id}
        isLoading={list.isLoading}
        error={err}
        emptyTitle="Belum ada pengguna"
        emptyDescription="Pengguna akan tampil di sini."
        searchPredicate={(u, q) => {
          const inq = q.toLowerCase()
          return u.name.toLowerCase().includes(inq) || u.email.toLowerCase().includes(inq)
        }}
        searchPlaceholder="Cari nama atau email..."
        page={paginated.page}
        totalPages={paginated.total_pages}
        total={paginated.total}
        onPageChange={setPage}
      />
    </div>
  )
}
