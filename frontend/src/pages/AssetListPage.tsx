import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { Amount } from "@/components/shared/Amount"
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { AssetStatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/auth/auth-context"
import { normalizePaginated, assetsApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate } from "@/lib/format"
import type { Asset, AssetStatus, AssetType } from "@/types"

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  tanah: "Tanah",
  bangunan: "Bangunan",
  uang: "Uang",
  lainnya: "Lainnya",
}

export const assetTypeLabel = (t: string) =>
  ASSET_TYPE_LABELS[t as AssetType] ?? t

export default function AssetListPage() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const canCreate = hasRole("admin", "pengelola_aset")

  const [assetType, setAssetType] = useState<AssetType | "all">("all")
  const [status, setStatus] = useState<AssetStatus | "all">("all")
  const [page, setPage] = useState(1)

  const list = useQuery({
    queryKey: queryKeys.assets({
      asset_type: assetType === "all" ? undefined : assetType,
      status: status === "all" ? undefined : status,
      page,
      limit: 10,
    }),
    queryFn: () =>
      assetsApi.list({
        asset_type: assetType === "all" ? undefined : assetType,
        status: status === "all" ? undefined : status,
        page,
        limit: 10,
      }),
  })

  const paginated = normalizePaginated(list.data, page, 10)

  const columns: DataTableColumn<Asset>[] = [
    {
      key: "code",
      header: "Kode",
      render: (a) => (
        <Link
          to={`/assets/${a.id}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {a.asset_code}
        </Link>
      ),
    },
    {
      key: "name",
      header: "Nama Aset",
      render: (a) => <span className="block max-w-56 truncate font-medium">{a.name}</span>,
    },
    { key: "type", header: "Jenis", render: (a) => assetTypeLabel(a.asset_type) },
    { key: "acquisition", header: "Perolehan", render: (a) => formatDate(a.acquisition_date) },
    {
      key: "value",
      header: "Nilai",
      className: "text-right",
      render: (a) => <Amount value={a.acquisition_value ?? 0} />,
    },
    {
      key: "location",
      header: "Lokasi",
      render: (a) => a.location ?? <span className="text-muted-foreground">-</span>,
    },
    { key: "status", header: "Status", render: (a) => <AssetStatusBadge status={a.status} /> },
  ]

  const err = list.error instanceof Error ? list.error.message : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Aset Wakaf"
        description="Daftar aset wakaf yang dikelola (tanah, bangunan, dan lainnya)"
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => navigate("/assets/new")}>
              <PlusIcon />Tambah Aset
            </Button>
          ) : null
        }
      />
      <DataTable<Asset>
        title="Daftar Aset Wakaf"
        description={`Total ${paginated.total} aset`}
        columns={columns}
        rows={paginated.items}
        rowKey={(a) => a.id}
        isLoading={list.isLoading}
        error={err}
        emptyTitle="Belum ada aset wakaf"
        emptyDescription={
          canCreate
            ? "Klik tombol tambah aset untuk mencatat aset wakaf."
            : "Belum ada aset yang tercatat."
        }
        onRowClick={(a) => navigate(`/assets/${a.id}`)}
        searchPredicate={(a, q) => {
          const inq = q.toLowerCase()
          return (
            a.name.toLowerCase().includes(inq) ||
            a.asset_code.toLowerCase().includes(inq) ||
            (a.location ?? "").toLowerCase().includes(inq)
          )
        }}
        searchPlaceholder="Cari nama, kode, atau lokasi..."
        page={paginated.page}
        totalPages={paginated.total_pages}
        total={paginated.total}
        onPageChange={setPage}
        toolbar={
          <>
            <Select
              value={assetType}
              onValueChange={(v) => {
                setAssetType(v as AssetType | "all")
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                <SelectItem value="tanah">Tanah</SelectItem>
                <SelectItem value="bangunan">Bangunan</SelectItem>
                <SelectItem value="uang">Uang</SelectItem>
                <SelectItem value="lainnya">Lainnya</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as AssetStatus | "all")
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="tidak_aktif">Tidak Aktif</SelectItem>
                <SelectItem value="dihapuskan">Dihapuskan</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
    </div>
  )
}
