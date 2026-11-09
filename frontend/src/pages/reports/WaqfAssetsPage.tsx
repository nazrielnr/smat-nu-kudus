import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { LandmarkIcon } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Amount } from "@/components/shared/Amount"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { ReportCard } from "@/components/shared/ReportCard"
import { assetTypeLabel } from "@/pages/AssetListPage"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { reportsApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate, periodLabel } from "@/lib/format"
import type { WaqfAssetsReport } from "@/types"

export default function WaqfAssetsPage() {
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()

  const report = useQuery({
    queryKey: queryKeys.reportWaqfAssets(dateFrom, dateTo),
    queryFn: () => reportsApi.waqfAssets(dateFrom, dateTo),
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan Rincian Aset Wakaf"
        description="Rincian aset wakaf beserta nilai perolehan"
        actions={
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        }
      />

      <ReportCard
        title="Rincian Aset"
        description={periodLabel(dateFrom, dateTo)}
        isLoading={report.isLoading}
        isError={report.isError}
        error={report.error}
        onRetry={() => report.refetch()}
        isEmpty={!!report.data && report.data.items.length === 0}
        emptyIcon={<LandmarkIcon />}
        emptyTitle="Belum ada aset"
        emptyDescription="Aset wakaf akan tampil di sini setelah dicatat."
      >
        {report.data ? <WaqfAssetsBody data={report.data} /> : null}
      </ReportCard>
    </div>
  )
}

function WaqfAssetsBody({ data }: { data: WaqfAssetsReport }) {
  return (
    <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Kode</TableHead>
            <TableHead>Nama Aset</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead>Perolehan</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead className="text-right">Nilai</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((a) => (
            <TableRow key={a.asset_id}>
              <TableCell className="font-mono text-sm">{a.asset_code}</TableCell>
              <TableCell className="font-medium">{a.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{assetTypeLabel(a.asset_type)}</Badge>
              </TableCell>
              <TableCell>{a.acquisition_date ? formatDate(a.acquisition_date) : "-"}</TableCell>
              <TableCell>{a.location ?? "-"}</TableCell>
              <TableCell className="text-right">
                <Amount value={a.acquisition_value ?? 0} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5} className="font-medium">
              Total Nilai Aset
            </TableCell>
            <TableCell className="text-right">
              <Amount
                value={data.total_value ?? data.items.reduce((acc, a) => acc + (a.acquisition_value ?? 0), 0)}
              />
            </TableCell>
          </TableRow>
        </TableFooter>
    </Table>
  )
}
