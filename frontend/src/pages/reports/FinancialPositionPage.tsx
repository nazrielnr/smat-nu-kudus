import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { Amount } from "@/components/shared/Amount"
import { BalanceBadge } from "@/components/shared/BalanceBadge"
import { DataState } from "@/components/shared/DataState"
import { DatePickerField } from "@/components/shared/DatePickerField"
import { StatList, StatRow } from "@/components/shared/StatList"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { reportsApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate, todayISO } from "@/lib/format"
import type { FinancialPositionReport, ReportRow } from "@/types"

export default function FinancialPositionPage() {
  const [date, setDate] = useState(todayISO())

  const report = useQuery({
    queryKey: queryKeys.reportFinancialPosition(date),
    queryFn: () => reportsApi.financialPosition(date),
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan Posisi Keuangan"
        description="Posisi aset, liabilitas, dan aset neto (neraca)"
        actions={<DatePickerField className="w-44" value={date} onChange={setDate} label="Per Tanggal" />}
      />

      <DataState
        framed
        isLoading={report.isLoading}
        isError={report.isError}
        error={report.error}
        onRetry={() => report.refetch()}
        rows={5}
      >
        {report.data ? <FinancialPositionBody data={report.data} date={date} /> : null}
      </DataState>
    </div>
  )
}

function FinancialPositionBody({ data, date }: { data: FinancialPositionReport; date: string }) {
  const totalAssets = data.total_aset ?? data.aset.reduce((acc, r) => acc + r.amount, 0)
  const totalLiab = data.total_liabilitas ?? data.liabilitas.reduce((acc, r) => acc + r.amount, 0)
  const totalNet = data.total_aset_neto ?? data.aset_neto.reduce((acc, r) => acc + r.amount, 0)

  const sections: {
    title: string
    rows: ReportRow[]
    total: number
  }[] = [
    { title: "Aset", rows: data.aset, total: totalAssets },
    { title: "Liabilitas", rows: data.liabilitas, total: totalLiab },
    { title: "Aset Kelolaan", rows: data.aset_neto, total: totalNet },
  ]

  const balanced = totalAssets === totalLiab + totalNet

  return (
    <>
      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>Posisi per {formatDate(date)}</CardDescription>
          </CardHeader>
          <CardContent>
            <DataState
              isLoading={false}
              isEmpty={section.rows.length === 0}
              emptyTitle={`Tidak ada data ${section.title.toLowerCase()}`}
              emptyDescription="Belum ada akun terposting pada kategori ini."
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Kode</TableHead>
                    <TableHead>Akun</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.rows.map((r) => (
                    <TableRow key={r.account_id ?? r.code}>
                      <TableCell className="font-mono text-sm">{r.code}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">
                        <Amount value={r.amount} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataState>
            <StatList className="pt-3">
              <StatRow label={`Total ${section.title}`} total>
                <Amount value={section.total} />
              </StatRow>
            </StatList>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan</CardTitle>
          <CardAction>
            <BalanceBadge balanced={balanced} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <StatList>
            <StatRow label="Total Aset">
              <Amount value={totalAssets} />
            </StatRow>
            <StatRow label="Total Liabilitas">
              <Amount value={totalLiab} />
            </StatRow>
            <StatRow label="Total Aset Kelolaan">
              <Amount value={totalNet} />
            </StatRow>
            <StatRow label="Aset = Liabilitas + Aset Kelolaan" total>
              <Amount value={totalLiab + totalNet} />
            </StatRow>
          </StatList>
        </CardContent>
      </Card>
    </>
  )
}
