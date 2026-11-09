import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { AmountCell } from "@/components/shared/AmountCell"
import { BalanceBadge } from "@/components/shared/BalanceBadge"
import { DatePickerField } from "@/components/shared/DatePickerField"
import { ReportCard } from "@/components/shared/ReportCard"
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
import { formatDate } from "@/lib/format"

export default function WorksheetPage() {
  const [date, setDate] = useState<string | undefined>()
  const report = useQuery({
    queryKey: queryKeys.reportWorksheet(date),
    queryFn: () => reportsApi.worksheet(date),
  })
  const data = report.data
  const hasRows = !!data && data.rows.length > 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kertas Kerja"
        description="Neraca saldo, jurnal penyesuaian (AJP), dan neraca saldo setelah disesuaikan"
        actions={<DatePickerField className="w-44" label="Per Tanggal" value={date} onChange={setDate} />}
      />
      <ReportCard
        title="Kertas Kerja"
        description={
          <>
            {date ? `Posisi per ${formatDate(date)}. ` : "Seluruh periode. "}
            Jurnal penyesuaian dikenali dari nomor berawalan AJP-; saldo ditempatkan di sisi normalnya.
          </>
        }
        actions={
          hasRows ? (
            <BalanceBadge
              balanced={data.balanced}
              labelOk="Ketiga pasang kolom seimbang"
              labelBad="Ada pasang kolom tidak seimbang"
            />
          ) : null
        }
        isLoading={report.isLoading}
        isError={report.isError}
        error={report.error}
        onRetry={() => report.refetch()}
        isEmpty={!hasRows}
        emptyDescription="Kertas kerja tampil setelah ada jurnal terposting."
        rows={8}
      >
        {data ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="w-24">Kode</TableHead>
                <TableHead rowSpan={2}>Nama Akun</TableHead>
                <TableHead colSpan={2} className="border-l text-center">Neraca Saldo</TableHead>
                <TableHead colSpan={2} className="border-l text-center">Penyesuaian</TableHead>
                <TableHead colSpan={2} className="border-l text-center">NS Setelah Disesuaikan</TableHead>
              </TableRow>
              <TableRow>
                {[0, 1, 2].flatMap((g) => [
                  <TableHead key={`d${g}`} className="border-l text-right">Debit</TableHead>,
                  <TableHead key={`c${g}`} className="text-right">Kredit</TableHead>,
                ])}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.account_id}>
                  <TableCell className="font-mono text-sm">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <AmountCell value={r.unadjusted_debit} className="border-l" />
                  <AmountCell value={r.unadjusted_credit} />
                  <AmountCell value={r.adjustment_debit} className="border-l" />
                  <AmountCell value={r.adjustment_credit} />
                  <AmountCell value={r.adjusted_debit} className="border-l" />
                  <AmountCell value={r.adjusted_credit} />
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total</TableCell>
                <AmountCell value={data.totals.unadjusted_debit} dashZero={false} className="border-l" />
                <AmountCell value={data.totals.unadjusted_credit} dashZero={false} />
                <AmountCell value={data.totals.adjustment_debit} dashZero={false} className="border-l" />
                <AmountCell value={data.totals.adjustment_credit} dashZero={false} />
                <AmountCell value={data.totals.adjusted_debit} dashZero={false} className="border-l" />
                <AmountCell value={data.totals.adjusted_credit} dashZero={false} />
              </TableRow>
            </TableFooter>
          </Table>
        ) : null}
      </ReportCard>
    </div>
  )
}
