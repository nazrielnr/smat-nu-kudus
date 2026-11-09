import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRightLeftIcon, LandmarkIcon, WalletIcon } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Amount } from "@/components/shared/Amount"
import { AmountCell } from "@/components/shared/AmountCell"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { ReportCard } from "@/components/shared/ReportCard"
import { SummaryCard } from "@/components/shared/SummaryCard"
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
import { formatRupiah, periodLabel } from "@/lib/format"

export default function ManagedAssetsPage() {
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()
  const report = useQuery({
    queryKey: queryKeys.reportManagedAssets(dateFrom, dateTo),
    queryFn: () => reportsApi.managedAssets(dateFrom, dateTo),
  })
  const data = report.data
  const isEmpty = !data || data.items.every((x) => x.closing === 0 && x.penambahan === 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan Perubahan Aset Kelolaan"
        description="Saldo awal, penambahan, revaluasi, penyusutan, dan saldo akhir aset kelolaan"
        actions={
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        }
      />

      {data && !isEmpty ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Saldo Awal"
            value={formatRupiah(data.totals.opening)}
            description={periodLabel(dateFrom, dateTo)}
            icon={<WalletIcon className="size-4" />}
            tone="sky"
          />
          <SummaryCard
            title="Perubahan Bersih"
            value={formatRupiah(data.totals.closing - data.totals.opening)}
            description="Saldo akhir dikurangi saldo awal"
            trend={data.totals.closing - data.totals.opening >= 0 ? "up" : "down"}
            icon={<ArrowRightLeftIcon className="size-4" />}
            tone="gold"
          />
          <SummaryCard
            title="Saldo Akhir"
            value={formatRupiah(data.totals.closing)}
            description="Total aset kelolaan"
            icon={<LandmarkIcon className="size-4" />}
            tone="primary"
          />
        </div>
      ) : null}

      <ReportCard
        title="Perubahan Aset Kelolaan"
        description="Wakaf uang diambil dari transaksi wakaf tunai; aset lain dari akun aset kelolaan (1-2xxx)."
        isLoading={report.isLoading}
        isError={report.isError}
        error={report.error}
        onRetry={() => report.refetch()}
        isEmpty={isEmpty}
        emptyIcon={<LandmarkIcon />}
        emptyDescription="Laporan tampil setelah ada aset kelolaan terjurnal."
      >
        {data ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jenis Aset</TableHead>
                <TableHead className="text-right">Saldo Awal</TableHead>
                <TableHead className="text-right">Penambahan</TableHead>
                <TableHead className="text-right">Pengurangan</TableHead>
                <TableHead className="text-right">Revaluasi</TableHead>
                <TableHead className="text-right">Penyusutan</TableHead>
                <TableHead className="text-right">Saldo Akhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <AmountCell value={r.opening} />
                  <AmountCell value={r.penambahan} />
                  <AmountCell value={r.pengurangan} />
                  <AmountCell value={r.revaluasi} />
                  <AmountCell value={-r.penyusutan} />
                  <TableCell className="text-right font-medium">
                    <Amount value={r.closing} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <AmountCell value={data.totals.opening} dashZero={false} />
                <AmountCell value={data.totals.penambahan} dashZero={false} />
                <AmountCell value={data.totals.pengurangan} dashZero={false} />
                <AmountCell value={data.totals.revaluasi} dashZero={false} />
                <AmountCell value={-data.totals.penyusutan} dashZero={false} />
                <AmountCell value={data.totals.closing} dashZero={false} />
              </TableRow>
            </TableFooter>
          </Table>
        ) : null}
      </ReportCard>
    </div>
  )
}
