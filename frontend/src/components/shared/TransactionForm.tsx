import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon, PaperclipIcon, SaveIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { DatePickerField } from "@/components/shared/DatePickerField"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { ApiClientError, categoriesApi, transactionsApi, wakifApi } from "@/services/api"
import { normalizeList, normalizePaginated } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatRupiah, parseRupiahInput, todayISO } from "@/lib/format"
import type {
  NewTransaction,
  PaymentMethod,
  Transaction,
  TransactionType,
} from "@/types"

const schema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib dipilih"),
  amount: z
    .number({ message: "Jumlah wajib diisi" })
    .int("Jumlah harus bilangan bulat rupiah")
    .min(1, "Jumlah minimal Rp 1"),
  description: z.string().min(3, "Deskripsi minimal 3 karakter").max(500, "Deskripsi maksimal 500 karakter"),
  category_id: z.string().min(1, "Kategori wajib dipilih"),
  wakif_id: z.string().optional(),
  payment_method: z.string().optional(),
  rekening_id: z.string().optional(),
  source_of_funds: z.string().max(200, "Maksimal 200 karakter").optional(),
  recipient: z.string().max(200, "Maksimal 200 karakter").optional(),
  attachment_url: z
    .string()
    .refine((v) => v === "" || z.string().url().safeParse(v).success, "Harus berupa URL yang valid")
    .optional(),
})

type FormValues = z.infer<typeof schema>

interface TransactionFormProps {
  transactionType: TransactionType
  /** Existing transaction for edit mode. */
  existing?: Transaction | null
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "tunai", label: "Tunai" },
  { value: "transfer", label: "Transfer Bank" },
  { value: "berjangka", label: "Wakaf Berjangka" },
]

function toFormValues(existing?: Transaction | null): FormValues {
  return {
    transaction_date: existing?.transaction_date ?? todayISO(),
    amount: existing?.amount ?? 0,
    description: existing?.description ?? "",
    category_id: existing?.category_id ?? "",
    wakif_id: existing?.wakif_id ?? "",
    payment_method: existing?.payment_method ?? "",
    rekening_id: existing?.rekening_id ?? "",
    source_of_funds: existing?.source_of_funds ?? "",
    recipient: existing?.recipient ?? "",
    attachment_url: existing?.attachment_url ?? "",
  }
}

export function TransactionForm({ transactionType, existing }: TransactionFormProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = existing != null
  const [amountDisplay, setAmountDisplay] = useState(
    existing ? formatRupiah(existing.amount).replace("Rp", "").trim() : "",
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(existing),
  })

  useEffect(() => {
    form.reset(toFormValues(existing))
    setAmountDisplay(existing ? formatRupiah(existing.amount).replace("Rp", "").trim() : "")
  }, [existing, form])

  const categories = useQuery({
    queryKey: queryKeys.categories({ transaction_type: transactionType }),
    queryFn: () => categoriesApi({ transaction_type: transactionType }),
  })

  const wakifList = useQuery({
    queryKey: queryKeys.wakif({ all: true }),
    queryFn: () => wakifApi.list({ limit: 100 }),
    enabled: transactionType === "penerimaan",
  })

  const wakifItems = normalizeList(
    wakifList.data != null ? normalizePaginated(wakifList.data, 1, 100) : null,
  )

  const buildPayload = (values: FormValues): NewTransaction => ({
    transaction_type: transactionType,
    transaction_date: values.transaction_date,
    amount: values.amount,
    description: values.description,
    category_id: values.category_id,
    wakif_id: transactionType === "penerimaan" && values.wakif_id ? values.wakif_id : null,
    payment_method: values.payment_method ? (values.payment_method as PaymentMethod) : null,
    rekening_id: values.rekening_id || null,
    source_of_funds: values.source_of_funds || null,
    recipient: values.recipient || null,
    attachment_url: values.attachment_url || null,
  })

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues & { submit: boolean }) => {
      const { submit, ...rest } = values
      const payload = buildPayload(rest)
      let saved: Transaction
      if (isEdit && existing) {
        saved = await transactionsApi.update(existing.id, payload)
      } else {
        saved = await transactionsApi.create(payload)
      }
      if (submit) {
        saved = await transactionsApi.submit(saved.id)
      }
      return saved
    },
    onSuccess: (saved, variables) => {
      toast.success(
        variables.submit
          ? "Transaksi disimpan dan diajukan untuk persetujuan"
          : "Transaksi disimpan sebagai draft",
      )
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      navigate(`/transactions/${saved.id}`)
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal menyimpan transaksi")
    },
  })

  const errors = form.formState.errors
  const isPenerimaan = transactionType === "penerimaan"
  const title = isPenerimaan
    ? isEdit
      ? "Edit Penerimaan Wakaf"
      : "Pencatatan Penerimaan Wakaf"
    : isEdit
      ? "Edit Pengeluaran Wakaf"
      : "Pencatatan Pengeluaran Wakaf"

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {isPenerimaan
            ? "Catat penerimaan wakaf uang atau aset dari wakif."
            : "Catat pengeluaran atau penyaluran manfaat wakaf."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((values) =>
            saveMutation.mutate({ ...values, submit: false }),
          )}
          className="flex flex-col gap-1"
          noValidate
        >
          <FieldGroup>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Controller
                control={form.control}
                name="transaction_date"
                render={({ field }) => (
                  <DatePickerField
                    label="Tanggal Transaksi"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.transaction_date?.message}
                  />
                )}
              />
              <Field data-invalid={errors.amount ? true : undefined}>
                <FieldLabel htmlFor="tx-amount">Jumlah (Rupiah)</FieldLabel>
                <FieldControl>
                  <Input
                    id="tx-amount"
                    inputMode="numeric"
                    placeholder="0"
                    value={amountDisplay}
                    onChange={(e) => {
                      const raw = e.target.value
                      const parsed = parseRupiahInput(raw)
                      setAmountDisplay(raw === "" ? "" : parsed.toLocaleString("id-ID"))
                      form.setValue("amount", parsed, { shouldValidate: true })
                    }}
                    onBlur={() => {
                      const amount = form.getValues("amount")
                      setAmountDisplay(amount > 0 ? amount.toLocaleString("id-ID") : "")
                    }}
                  />
                </FieldControl>
                <FieldDescription>
                  Masukkan angka; format otomatis. Nilai:{" "}
                  {formatRupiah(form.watch("amount") ?? 0)}
                </FieldDescription>
                {errors.amount ? (
                  <FieldError errors={[{ message: errors.amount.message }]} />
                ) : null}
              </Field>
            </div>

            <Field data-invalid={errors.category_id ? true : undefined}>
              <FieldLabel>Kategori</FieldLabel>
              <FieldControl>
                <Controller
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        {normalizeList(categories.data).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldControl>
              {errors.category_id ? (
                <FieldError errors={[{ message: errors.category_id.message }]} />
              ) : null}
            </Field>

            {isPenerimaan ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field>
                  <FieldLabel>Wakif</FieldLabel>
                  <FieldControl>
                    <Controller
                      control={form.control}
                      name="wakif_id"
                      render={({ field }) => (
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih wakif" />
                          </SelectTrigger>
                          <SelectContent>
                            {wakifItems.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FieldControl>
                </Field>
                <Field>
                  <FieldLabel>Metode Pembayaran</FieldLabel>
                  <FieldControl>
                    <Controller
                      control={form.control}
                      name="payment_method"
                      render={({ field }) => (
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih metode" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FieldControl>
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field data-invalid={errors.recipient ? true : undefined}>
                  <FieldLabel htmlFor="tx-recipient">Penerima / Pihak yang Dibayar</FieldLabel>
                  <FieldControl>
                    <Input
                      id="tx-recipient"
                      placeholder="Nama penerima"
                      {...form.register("recipient")}
                    />
                  </FieldControl>
                  {errors.recipient ? (
                    <FieldError errors={[{ message: errors.recipient.message }]} />
                  ) : null}
                </Field>
                <Field data-invalid={errors.source_of_funds ? true : undefined}>
                  <FieldLabel htmlFor="tx-source">Sumber Dana</FieldLabel>
                  <FieldControl>
                    <Input
                      id="tx-source"
                      placeholder="Misal: Kas Tunai, Rekening Operasional"
                      {...form.register("source_of_funds")}
                    />
                  </FieldControl>
                  {errors.source_of_funds ? (
                    <FieldError errors={[{ message: errors.source_of_funds.message }]} />
                  ) : null}
                </Field>
              </div>
            )}

            <Field data-invalid={errors.description ? true : undefined}>
              <FieldLabel htmlFor="tx-desc">Deskripsi</FieldLabel>
              <FieldControl>
                <Textarea
                  id="tx-desc"
                  rows={3}
                  placeholder={
                    isPenerimaan
                      ? "Deskripsi penerimaan wakaf (misal: wakaf uang tunai untuk pembangunan masjid)"
                      : "Deskripsi pengeluaran (misal: penyaluran manfaat wakaf untuk biaya pendidikan)"
                  }
                  {...form.register("description")}
                />
              </FieldControl>
              {errors.description ? (
                <FieldError errors={[{ message: errors.description.message }]} />
              ) : null}
            </Field>

            <Field data-invalid={errors.attachment_url ? true : undefined}>
              <FieldLabel htmlFor="tx-attachment">URL Lampiran (opsional)</FieldLabel>
              <FieldControl>
                <Input
                  id="tx-attachment"
                  placeholder="https://... (bukti transaksi, kwitansi, dsb.)"
                  {...form.register("attachment_url")}
                />
              </FieldControl>
              <FieldDescription>
                <PaperclipIcon className="mr-1 inline size-3" />
                Tautan dokumen pendukung transaksi.
              </FieldDescription>
              {errors.attachment_url ? (
                <FieldError errors={[{ message: errors.attachment_url.message }]} />
              ) : null}
            </Field>
          </FieldGroup>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={saveMutation.isPending}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={form.handleSubmit((values) =>
                saveMutation.mutate({ ...values, submit: false }),
              )}
            >
              {saveMutation.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SaveIcon />
              )}
              Simpan Draft
            </Button>
            <Button
              type="button"
              disabled={saveMutation.isPending}
              onClick={form.handleSubmit((values) =>
                saveMutation.mutate({ ...values, submit: true }),
              )}
            >
              {saveMutation.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SendIcon />
              )}
              Simpan & Ajukan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
