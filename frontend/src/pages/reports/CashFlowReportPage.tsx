import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { Amount } from "@/components/shared/Amount"
import { AmountCell } from "@/components/shared/AmountCell"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { ReportCard } from "@/components/shared/ReportCard"
import { StatList, StatRow } from "@/components/shared/StatList"
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
import { periodLabel } from "@/lib/format"
import type { CashFlowReport } from "@/types"

const ACTIVITY_LABELS: Record<string, string> = {
  operating: "Aktivitas Operasi",
  investing: "Aktivitas Investasi",
  financing: "Aktivitas Pendanaan",
}

export default function CashFlowReportPage() {
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()

  const report = useQuery({
    queryKey: queryKeys.reportCashFlow(dateFrom, dateTo),
    queryFn: () => reportsApi.cashFlow(dateFrom, dateTo),
  })

  const data: CashFlowReport | undefined = report.data
  const isEmpty =
    !!data &&
    Object.keys(ACTIVITY_LABELS).every((k) => !(data as Record<string, unknown>)[k]) &&
    data.penerimaan == null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan Arus Kas"
        description="Arus kas masuk dan keluar pada periode terpilih"
        actions={
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        }
      />

      <ReportCard
        title="Arus Kas"
        description={periodLabel(dateFrom, dateTo)}
        isLoading={report.isLoading}
        isError={report.isError}
        error={report.error}
        onRetry={() => report.refetch()}
        isEmpty={isEmpty}
        emptyTitle="Belum ada data arus kas"
        emptyDescription="Laporan arus kas akan tampil setelah ada transaksi terposting."
      >
        {data ? <CashFlowBody data={data} /> : null}
      </ReportCard>
    </div>
  )
}

function CashFlowBody({ data }: { data: CashFlowReport }) {
  const sections = (["operating", "investing", "financing"] as const).filter(
    (k) => Array.isArray((data as Record<string, unknown>)[k]),
  ) as ("operating" | "investing" | "financing")[]

  if (sections.length > 0) {
    return (
      <div className="flex flex-col gap-6">
        {sections.map((key) => {
          const items = (data[key] ?? []) as Array<{ description: string; amount: number }>
          const total = items.reduce((acc, item) => acc + item.amount, 0)
          if (items.length === 0) return null
          return (
            <div key={key}>
              <h3 className="mb-2 text-sm font-semibold">{ACTIVITY_LABELS[key]}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Uraian</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.description}</TableCell>
                      <AmountCell
                        value={item.amount}
                        dashZero={false}
                        colored={item.amount >= 0 ? "penerimaan" : "pengeluaran"}
                        signed
                      />
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Subtotal {ACTIVITY_LABELS[key]}</TableCell>
                    <AmountCell
                      value={total}
                      dashZero={false}
                      signed
                      colored={total >= 0 ? "penerimaan" : "pengeluaran"}
                    />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )
        })}
        <StatList className="rounded-2xl bg-muted/50 p-4">
          {data.beginning_balance != null ? (
            <StatRow label="Saldo Awal Kas">
              <Amount value={data.beginning_balance} />
            </StatRow>
          ) : null}
          <StatRow label="Perubahan Bersih">
            <Amount
              value={data.net_change ?? 0}
              signed
              colored={(data.net_change ?? 0) >= 0 ? "penerimaan" : "pengeluaran"}
            />
          </StatRow>
          {data.ending_balance != null ? (
            <StatRow label="Saldo Akhir Kas" total>
              <Amount value={data.ending_balance} />
            </StatRow>
          ) : null}
        </StatList>
      </div>
    )
  }

  // Simple aggregate shape: penerimaan / pengeluaran.
  const penerimaan = data.penerimaan ?? 0
  const pengeluaran = data.pengeluaran ?? 0
  return (
    <StatList>
      <StatRow label="Total Penerimaan (Arus Masuk)">
        <Amount value={penerimaan} colored="penerimaan" />
      </StatRow>
      <StatRow label="Total Pengeluaran (Arus Keluar)">
        <Amount value={-pengeluaran} colored="pengeluaran" signed />
      </StatRow>
      <StatRow label="Arus Kas Bersih" total>
        <Amount
          value={penerimaan - pengeluaran}
          signed
          colored={penerimaan - pengeluaran >= 0 ? "penerimaan" : "pengeluaran"}
        />
      </StatRow>
    </StatList>
  )
}
