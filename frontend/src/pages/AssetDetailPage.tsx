import { useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  FileTextIcon,
  HistoryIcon,
  PencilIcon,
  UploadIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Amount } from "@/components/shared/Amount"
import { PageHeader } from "@/components/shared/PageHeader"
import { AssetStatusBadge } from "@/components/shared/StatusBadge"
import { assetTypeLabel } from "@/pages/AssetListPage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useAuth } from "@/auth/auth-context"
import { ApiClientError, assetsApi, normalizeList } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format"
import type { AssetDocument, AssetHistoryEntry } from "@/types"

function DocumentsTab({ assetId }: { assetId: string }) {
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const canUpload = hasRole("admin", "pengelola_aset")
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState("")
  const [description, setDescription] = useState("")

  const docs = useQuery({
    queryKey: queryKeys.assetDocuments(assetId),
    queryFn: () => assetsApi.documents(assetId),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      assetsApi.uploadDocument(assetId, file, docType || undefined, description || undefined),
    onSuccess: () => {
      toast.success("Dokumen berhasil diunggah")
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      setDocType("")
      setDescription("")
      setUploading(false)
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal mengunggah dokumen")
      setUploading(false)
    },
  })

  const docItems: AssetDocument[] = normalizeList(docs.data)

  return (
    <div className="flex flex-col gap-4">
      {canUpload ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor="doc-type">
              Jenis Dokumen
            </label>
            <Input
              id="doc-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              placeholder="Misal: Sertifikat, AJB"
              className="w-48"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor="doc-desc">
              Keterangan
            </label>
            <Input
              id="doc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Keterangan dokumen"
              className="w-56"
            />
          </div>
          <Button
            size="sm"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            <UploadIcon />
            {uploading ? "Mengunggah..." : "Unggah Dokumen"}
          </Button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                setUploading(true)
                uploadMutation.mutate(file)
              }
              e.target.value = ""
            }}
          />
        </div>
      ) : null}

      {docs.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : docItems.length === 0 ? (
        <Empty className="min-h-32 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>Belum ada dokumen</EmptyTitle>
            <EmptyDescription>
              {canUpload
                ? "Unggah sertifikat, AJB, atau dokumen pendukung lainnya."
                : "Dokumen aset akan tampil di sini."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {docItems.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {doc.file_name ?? doc.document_type ?? "Dokumen"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[doc.document_type, doc.description].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
              {doc.file_size ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.max(1, Math.round(doc.file_size / 1024))} KB
                </span>
              ) : null}
              <Button size="sm" variant="outline" asChild>
                <a href={doc.url} target="_blank" rel="noreferrer">
                  Lihat
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function HistoryTab({ assetId }: { assetId: string }) {
  const history = useQuery({
    queryKey: queryKeys.assetHistory(assetId),
    queryFn: () => assetsApi.history(assetId),
  })

  const items: AssetHistoryEntry[] = normalizeList(history.data)

  if (history.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Empty className="min-h-32 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>Belum ada riwayat</EmptyTitle>
          <EmptyDescription>Perubahan pada aset akan tercatat di sini.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ol className="flex flex-col gap-4">
      {items.map((h) => (
        <li key={h.id} className="flex gap-3">
          <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{h.action ?? "Perubahan"}</span>
            {h.description ? (
              <span className="text-sm text-muted-foreground">{h.description}</span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {formatDateTime(h.created_at)}
              {h.performed_by_name ? ` — oleh ${h.performed_by_name}` : ""}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const canEdit = hasRole("admin", "pengelola_aset")

  const detail = useQuery({
    queryKey: queryKeys.asset(id ?? ""),
    queryFn: () => assetsApi.get(id ?? ""),
    enabled: id != null,
  })

  if (!id) return null

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (detail.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate("/assets")} className="w-fit">
          <ArrowLeftIcon />Kembali
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            Gagal memuat aset: {detail.error.message}
          </CardContent>
        </Card>
      </div>
    )
  }

  const a = detail.data!

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={a.name}
        description={`Aset wakaf ${assetTypeLabel(a.asset_type)} — kode ${a.asset_code}`}
        backHref="/assets"
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => navigate(`/assets/${a.id}/edit`)}>
              <PencilIcon />Edit Aset
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informasi Aset</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Kode Aset</dt>
                <dd className="text-sm font-medium">{a.asset_code}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Jenis</dt>
                <dd className="text-sm font-medium">{assetTypeLabel(a.asset_type)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd>
                  <AssetStatusBadge status={a.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tanggal Perolehan</dt>
                <dd className="text-sm font-medium">{formatDate(a.acquisition_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Nilai Perolehan</dt>
                <dd className="text-sm font-medium">
                  <Amount value={a.acquisition_value ?? 0} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Nomor Sertifikat</dt>
                <dd className="text-sm font-medium">{a.certificate_number ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Luas</dt>
                <dd className="text-sm font-medium">
                  {a.area ? `${a.area.toLocaleString("id-ID")} m²` : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Lokasi</dt>
                <dd className="text-sm font-medium">{a.location ?? "-"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Deskripsi</dt>
                <dd className="text-sm">{a.description ?? "-"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nilai Aset</CardTitle>
            <CardDescription>Nilai perolehan tercatat</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatRupiah(a.acquisition_value ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <Link to="/reports/waqf-assets" className="text-primary underline-offset-4 hover:underline">
                Lihat laporan rincian aset
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dokumen & Riwayat</CardTitle>
          <CardDescription>Dokumen pendukung dan riwayat perubahan aset</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="documents">
            <TabsList>
              <TabsTrigger value="documents">Dokumen</TabsTrigger>
              <TabsTrigger value="history">Riwayat</TabsTrigger>
            </TabsList>
            <TabsContent value="documents" className="pt-4">
              <DocumentsTab assetId={a.id} />
            </TabsContent>
            <TabsContent value="history" className="pt-4">
              <HistoryTab assetId={a.id} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
