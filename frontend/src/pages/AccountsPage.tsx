import { useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
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
import { useAuth } from "@/auth/auth-context"
import { accountsApi, normalizeList } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import type { Account, AccountType } from "@/types"

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  aset: "Aset",
  liabilitas: "Liabilitas",
  aset_neto: "Aset Neto",
  pendapatan: "Pendapatan",
  beban: "Beban",
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "aset", label: "Aset" },
  { value: "liabilitas", label: "Liabilitas" },
  { value: "aset_neto", label: "Aset Neto" },
  { value: "pendapatan", label: "Pendapatan" },
  { value: "beban", label: "Beban" },
]

const schema = z.object({
  code: z.string().min(1, "Kode akun wajib diisi").max(20, "Maksimal 20 karakter"),
  name: z.string().min(2, "Nama minimal 2 karakter").max(100, "Maksimal 100 karakter"),
  account_type: z.enum(["aset", "liabilitas", "aset_neto", "pendapatan", "beban"], {
    message: "Tipe akun wajib dipilih",
  }),
})

type FormValues = z.infer<typeof schema>

export default function AccountsPage() {
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const isAdmin = hasRole("admin")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<AccountType | "all">("all")

  const list = useQuery({
    queryKey: queryKeys.accounts({ account_type: typeFilter === "all" ? undefined : typeFilter }),
    queryFn: () =>
      accountsApi.list({ account_type: typeFilter === "all" ? undefined : typeFilter }),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", name: "", account_type: "aset" },
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => accountsApi.create(values),
    onSuccess: () => {
      toast.success("Akun berhasil ditambahkan")
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      setDialogOpen(false)
      form.reset({ code: "", name: "", account_type: "aset" })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menambahkan akun")
    },
  })

  const items: Account[] = normalizeList(list.data)

  const columns: DataTableColumn<Account>[] = [
    {
      key: "code",
      header: "Kode",
      render: (a) => (
        <Link
          to={`/ledger?account_id=${a.id}`}
          className="font-mono text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {a.code}
        </Link>
      ),
    },
    {
      key: "name",
      header: "Nama Akun",
      render: (a) => <span className="font-medium">{a.name}</span>,
    },
    {
      key: "type",
      header: "Tipe",
      render: (a) => ACCOUNT_TYPE_LABELS[a.account_type] ?? a.account_type,
    },
    {
      key: "status",
      header: "Status",
      render: (a) =>
        a.is_active === false ? (
          <span className="text-sm text-muted-foreground">Tidak Aktif</span>
        ) : (
          <span className="text-sm text-foreground">Aktif</span>
        ),
    },
  ]

  const err = list.error instanceof Error ? list.error.message : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bagan Akun (COA)"
        description="Daftar akun buku besar (chart of accounts)"
        actions={
          isAdmin ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
              <Button size="sm"><PlusIcon />Tambah Akun</Button>
            </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Tambah Akun</DialogTitle>
                  <DialogDescription>Akun baru untuk bagan akun.</DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
                  className="flex flex-col gap-1"
                  noValidate
                >
                  <FieldGroup>
                    <Field data-invalid={form.formState.errors.code ? true : undefined}>
                      <FieldLabel htmlFor="acc-code">Kode Akun</FieldLabel>
                      <FieldControl>
                        <Input id="acc-code" placeholder="Misal: 1-1100" {...form.register("code")} />
                      </FieldControl>
                      {form.formState.errors.code ? (
                        <FieldError errors={[{ message: form.formState.errors.code.message }]} />
                      ) : null}
                    </Field>
                    <Field data-invalid={form.formState.errors.name ? true : undefined}>
                      <FieldLabel htmlFor="acc-name">Nama Akun</FieldLabel>
                      <FieldControl>
                        <Input
                          id="acc-name"
                          placeholder="Misal: Kas Tunai"
                          {...form.register("name")}
                        />
                      </FieldControl>
                      {form.formState.errors.name ? (
                        <FieldError errors={[{ message: form.formState.errors.name.message }]} />
                      ) : null}
                    </Field>
                    <Field data-invalid={form.formState.errors.account_type ? true : undefined}>
                      <FieldLabel>Tipe Akun</FieldLabel>
                      <FieldControl>
                        <Controller
                          control={form.control}
                          name="account_type"
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACCOUNT_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldControl>
                      {form.formState.errors.account_type ? (
                        <FieldError
                          errors={[{ message: form.formState.errors.account_type.message }]}
                        />
                      ) : null}
                    </Field>
                  </FieldGroup>
                  <DialogFooter className="mt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      Simpan
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />
      <DataTable<Account>
        title="Daftar Akun"
        description={`Total ${items.length} akun`}
        columns={columns}
        rows={items}
        rowKey={(a) => a.id}
        isLoading={list.isLoading}
        error={err}
        emptyTitle="Belum ada akun"
        emptyDescription="Akun akan tampil setelah ditambahkan."
        searchPredicate={(a, q) =>
          a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)
        }
        searchPlaceholder="Cari kode atau nama akun..."
        toolbar={
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as AccountType | "all")}
          >
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              {ACCOUNT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </div>
  )
}
