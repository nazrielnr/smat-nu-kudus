import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeySquareIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { PageHeader } from "@/components/shared/PageHeader"
import { roleLabel } from "@/components/layout/Header"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/auth/auth-context"
import { ApiClientError, authApi } from "@/services/api"

const passwordSchema = z
  .object({
    old_password: z.string().min(1, "Kata sandi lama wajib diisi"),
    new_password: z
      .string()
      .min(8, "Minimal 8 karakter")
      .regex(/[A-Z]/, "Harus mengandung huruf kapital")
      .regex(/[0-9]/, "Harus mengandung angka")
      .regex(/[^A-Za-z0-9]/, "Harus mengandung karakter khusus"),
    confirm_password: z.string().min(1, "Konfirmasi wajib diisi"),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Konfirmasi tidak sama dengan kata sandi baru",
  })

type PasswordForm = z.infer<typeof passwordSchema>

export default function SettingsPage() {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)

  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { old_password: "", new_password: "", confirm_password: "" },
  })

  const changeMutation = useMutation({
    mutationFn: (values: PasswordForm) =>
      authApi.changePassword(values.old_password, values.new_password),
    onSuccess: () => {
      toast.success("Kata sandi berhasil diubah")
      setSaved(true)
      form.reset({ old_password: "", new_password: "", confirm_password: "" })
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal mengubah kata sandi")
    },
  })

  if (!user) return null

  const errors = form.formState.errors

  return (
    <div className="flex flex-col gap-6">
      <PageHeader printable={false} title="Pengaturan" description="Profil pengguna dan keamanan akun" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil Saya</CardTitle>
            <CardDescription>Informasi akun Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback>
                  {user.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
            </div>
            <Separator className="my-4" />
            <dl className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="text-sm font-medium">{user.email}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-muted-foreground">Peran</dt>
                <dd>
                  <Badge variant="secondary">{roleLabel(user.role)}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="text-sm font-medium">
                  {user.status === "nonaktif" ? "Nonaktif" : "Aktif"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ubah Kata Sandi</CardTitle>
            <CardDescription>Perbarui kata sandi akun Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((values) => {
                setSaved(false)
                changeMutation.mutate(values)
              })}
              className="flex flex-col gap-1"
              noValidate
            >
              <FieldGroup>
                <Field data-invalid={errors.old_password ? true : undefined}>
                  <FieldLabel htmlFor="old-pass">Kata Sandi Lama</FieldLabel>
                  <FieldControl>
                    <Input id="old-pass" type="password" {...form.register("old_password")} />
                  </FieldControl>
                  {errors.old_password ? (
                    <FieldError errors={[{ message: errors.old_password.message }]} />
                  ) : null}
                </Field>
                <Field data-invalid={errors.new_password ? true : undefined}>
                  <FieldLabel htmlFor="new-pass">Kata Sandi Baru</FieldLabel>
                  <FieldControl>
                    <Input id="new-pass" type="password" {...form.register("new_password")} />
                  </FieldControl>
                  <FieldDescription>
                    Minimal 8 karakter, huruf kapital, angka, dan karakter khusus.
                  </FieldDescription>
                  {errors.new_password ? (
                    <FieldError errors={[{ message: errors.new_password.message }]} />
                  ) : null}
                </Field>
                <Field data-invalid={errors.confirm_password ? true : undefined}>
                  <FieldLabel htmlFor="confirm-pass">Konfirmasi Kata Sandi Baru</FieldLabel>
                  <FieldControl>
                    <Input id="confirm-pass" type="password" {...form.register("confirm_password")} />
                  </FieldControl>
                  {errors.confirm_password ? (
                    <FieldError errors={[{ message: errors.confirm_password.message }]} />
                  ) : null}
                </Field>
              </FieldGroup>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                  disabled={changeMutation.isPending}
                >
                  Reset
                </Button>
                <Button type="submit" disabled={changeMutation.isPending}>
                  {changeMutation.isPending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <KeySquareIcon />
                  )}
                  Ubah Kata Sandi
                </Button>
              </div>
              {saved ? (
                <p className="pt-2 text-xs text-emerald-600">Kata sandi berhasil diperbarui.</p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Sistem</CardTitle>
          <CardDescription>
            Pengaturan lainnya (kategori transaksi, akun default, dsb.) dikelola oleh admin
            melalui backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Belum ada pengaturan sistem tambahan yang dapat dikonfigurasi dari antarmuka.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
