import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon, SaveIcon } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { DatePickerField } from "@/components/shared/DatePickerField"
import { PageHeader } from "@/components/shared/PageHeader"
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
import { ApiClientError, assetsApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { parseRupiahInput } from "@/lib/format"
import type { AssetStatus, AssetType } from "@/types"

const schema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  asset_type: z.enum(["tanah", "bangunan", "uang", "lainnya"], { message: "Jenis aset wajib dipilih" }),
  status: z.enum(["aktif", "tidak_aktif", "dihapuskan"]),
  acquisition_date: z.string().optional(),
  acquisition_value: z.number().int().min(0).optional(),
  certificate_number: z.string().max(100, "Maksimal 100 karakter").optional(),
  location: z.string().max(200, "Maksimal 200 karakter").optional(),
  area: z.number().min(0, "Luas tidak boleh negatif").optional(),
  description: z.string().max(1000, "Maksimal 1000 karakter").optional(),
})

type FormValues = z.infer<typeof schema>

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "tanah", label: "Tanah" },
  { value: "bangunan", label: "Bangunan" },
  { value: "uang", label: "Uang" },
  { value: "lainnya", label: "Lainnya" },
]

const ASSET_STATUSES: { value: AssetStatus; label: string }[] = [
  { value: "aktif", label: "Aktif" },
  { value: "tidak_aktif", label: "Tidak Aktif" },
  { value: "dihapuskan", label: "Dihapuskan" },
]

export default function AssetFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = id != null

  const existing = useQuery({
    queryKey: queryKeys.asset(id ?? ""),
    queryFn: () => assetsApi.get(id ?? ""),
    enabled: isEdit,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      asset_type: "tanah",
      status: "aktif",
    },
  })

  useEffect(() => {
    if (isEdit && existing.data) {
      form.reset({
        name: existing.data.name,
        asset_type: existing.data.asset_type,
        status: existing.data.status,
        acquisition_date: existing.data.acquisition_date ?? "",
        acquisition_value: existing.data.acquisition_value ?? 0,
        certificate_number: existing.data.certificate_number ?? "",
        location: existing.data.location ?? "",
        area: existing.data.area ?? undefined,
        description: existing.data.description ?? "",
      })
    }
  }, [isEdit, existing.data, form])

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        asset_type: values.asset_type,
        status: values.status,
        acquisition_date: values.acquisition_date || undefined,
        acquisition_value: values.acquisition_value || undefined,
        certificate_number: values.certificate_number || undefined,
        location: values.location || undefined,
        area: values.area || undefined,
        description: values.description || undefined,
      }
      if (isEdit && id) return assetsApi.update(id, payload)
      return assetsApi.create(payload)
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? "Aset berhasil diperbarui" : "Aset berhasil ditambahkan")
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      navigate(`/assets/${saved.id}`)
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal menyimpan aset")
    },
  })

  const errors = form.formState.errors

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        printable={false}
        title={isEdit ? "Edit Aset Wakaf" : "Tambah Aset Wakaf"}
        description="Data aset wakaf yang dikelola oleh LWPNU Kabupaten Kudus"
        backHref={isEdit ? `/assets/${id}` : "/assets"}
      />
      <Card>
        <CardHeader>
          <CardTitle>Data Aset</CardTitle>
          <CardDescription>
            Lengkapi informasi aset wakaf. Nilai dalam rupiah (bilangan bulat).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            className="flex flex-col gap-1"
            noValidate
          >
            <FieldGroup>
              <Field data-invalid={errors.name ? true : undefined}>
                <FieldLabel htmlFor="asset-name">Nama Aset</FieldLabel>
                <FieldControl>
                  <Input
                    id="asset-name"
                    placeholder="Misal: Tanah Wakif H. Ahmad"
                    {...form.register("name")}
                  />
                </FieldControl>
                {errors.name ? <FieldError errors={[{ message: errors.name.message }]} /> : null}
              </Field>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field data-invalid={errors.asset_type ? true : undefined}>
                  <FieldLabel>Jenis Aset</FieldLabel>
                  <FieldControl>
                    <Controller
                      control={form.control}
                      name="asset_type"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih jenis" />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSET_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FieldControl>
                  {errors.asset_type ? (
                    <FieldError errors={[{ message: errors.asset_type.message }]} />
                  ) : null}
                </Field>
                <Field data-invalid={errors.status ? true : undefined}>
                  <FieldLabel>Status</FieldLabel>
                  <FieldControl>
                    <Controller
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih status" />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSET_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FieldControl>
                  {errors.status ? (
                    <FieldError errors={[{ message: errors.status.message }]} />
                  ) : null}
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Controller
                  control={form.control}
                  name="acquisition_date"
                  render={({ field }) => (
                    <DatePickerField
                      label="Tanggal Perolehan"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.acquisition_date?.message}
                    />
                  )}
                />
                <Field data-invalid={errors.acquisition_value ? true : undefined}>
                  <FieldLabel htmlFor="asset-value">Nilai Perolehan (Rupiah)</FieldLabel>
                  <FieldControl>
                    <Input
                      id="asset-value"
                      inputMode="numeric"
                      placeholder="0"
                      value={
                        form.watch("acquisition_value")
                          ? form.watch("acquisition_value")!.toLocaleString("id-ID")
                          : ""
                      }
                      onChange={(e) => {
                        const parsed = parseRupiahInput(e.target.value)
                        form.setValue("acquisition_value", parsed, { shouldValidate: true })
                      }}
                    />
                  </FieldControl>
                  <FieldDescription>Bilangan bulat rupiah.</FieldDescription>
                  {errors.acquisition_value ? (
                    <FieldError errors={[{ message: errors.acquisition_value.message }]} />
                  ) : null}
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field data-invalid={errors.certificate_number ? true : undefined}>
                  <FieldLabel htmlFor="asset-cert">Nomor Sertifikat</FieldLabel>
                  <FieldControl>
                    <Input
                      id="asset-cert"
                      placeholder="Nomor sertifikat (bila ada)"
                      {...form.register("certificate_number")}
                    />
                  </FieldControl>
                  {errors.certificate_number ? (
                    <FieldError errors={[{ message: errors.certificate_number.message }]} />
                  ) : null}
                </Field>
                <Field data-invalid={errors.area ? true : undefined}>
                  <FieldLabel htmlFor="asset-area">Luas (m²)</FieldLabel>
                  <FieldControl>
                    <Input
                      id="asset-area"
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Misal: 250"
                      {...form.register("area", { valueAsNumber: true })}
                    />
                  </FieldControl>
                  {errors.area ? (
                    <FieldError errors={[{ message: errors.area.message }]} />
                  ) : null}
                </Field>
              </div>

              <Field data-invalid={errors.location ? true : undefined}>
                <FieldLabel htmlFor="asset-loc">Lokasi</FieldLabel>
                <FieldControl>
                  <Input
                    id="asset-loc"
                    placeholder="Alamat / lokasi aset"
                    {...form.register("location")}
                  />
                </FieldControl>
                {errors.location ? (
                  <FieldError errors={[{ message: errors.location.message }]} />
                ) : null}
              </Field>

              <Field data-invalid={errors.description ? true : undefined}>
                <FieldLabel htmlFor="asset-desc">Deskripsi</FieldLabel>
                <FieldControl>
                  <Textarea
                    id="asset-desc"
                    rows={3}
                    placeholder="Keterangan tambahan aset"
                    {...form.register("description")}
                  />
                </FieldControl>
                {errors.description ? (
                  <FieldError errors={[{ message: errors.description.message }]} />
                ) : null}
              </Field>
            </FieldGroup>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(isEdit ? `/assets/${id}` : "/assets")}
                disabled={saveMutation.isPending}
              >
                Batal
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <SaveIcon />
                )}
                Simpan Aset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
