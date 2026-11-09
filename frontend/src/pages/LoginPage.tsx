import { useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { Loader2Icon, LockIcon } from "lucide-react"
import { z } from "zod"
import { toast } from "sonner"
import { useAuth } from "@/auth/auth-context"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldControl,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ApiClientError } from "@/services/api"

const loginSchema = z.object({
  email: z.string().min(1, "Email wajib diisi").email("Format email tidak valid"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const loginMutation = useMutation({
    mutationFn: (values: LoginForm) => login(values.email, values.password),
    onSuccess: () => {
      toast.success("Berhasil masuk")
      const from = (location.state as { from?: string } | null)?.from ?? "/"
      navigate(from, { replace: true })
    },
    onError: (err) => {
      const message =
        err instanceof ApiClientError ? err.message : "Terjadi kesalahan saat masuk"
      setError(message)
      setErrorKey((k) => k + 1)
    },
  })

  if (user) return <Navigate to="/" replace />

  const onSubmit = form.handleSubmit((values) => loginMutation.mutate(values))

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted/40 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/logo.png" alt="Logo LWPNU" className="size-16 rounded-xl bg-white object-contain ring-1 ring-border" />
        <h1 className="text-2xl font-semibold tracking-tight">SMAT NU Kudus</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sistem Monitoring Aset Wakaf dan Tanah Nahdlatul Ulama Kabupaten Kudus
        </p>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Masuk</CardTitle>
          <CardDescription>Masukkan email dan kata sandi Anda.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <Field
              data-invalid={form.formState.errors.email ? true : undefined}
              key={`email-${errorKey}`}
            >
              <FieldLabel htmlFor="login-email">Email</FieldLabel>
              <FieldControl>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="nama@nu-kudus.id"
                  autoComplete="email"
                  {...form.register("email")}
                />
              </FieldControl>
              {form.formState.errors.email ? (
                <FieldError errors={[{ message: form.formState.errors.email.message }]} />
              ) : null}
            </Field>
            <Field data-invalid={form.formState.errors.password ? true : undefined}>
              <FieldLabel htmlFor="login-password">Kata Sandi</FieldLabel>
              <FieldControl>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...form.register("password")}
                />
              </FieldControl>
              {form.formState.errors.password ? (
                <FieldError errors={[{ message: form.formState.errors.password.message }]} />
              ) : null}
            </Field>
            {error ? (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={loginMutation.isPending} className="w-full">
              {loginMutation.isPending ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
              {loginMutation.isPending ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col gap-2 border-t">
          <p className="text-xs text-muted-foreground">
            Lupa kata sandi? Hubungi administrator sistem.
          </p>
        </CardFooter>
      </Card>
      <p className="text-xs text-muted-foreground">© LWPNU — Kabupaten Kudus</p>
    </main>
  )
}
