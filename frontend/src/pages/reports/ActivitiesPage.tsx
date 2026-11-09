import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { MinusIcon, PlusIcon } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Amount } from "@/components/shared/Amount"
import { DataState } from "@/components/shared/DataState"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { StatList, StatRow } from "@/components/shared/StatList"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import type { ActivitiesReport, ActivityGroup } from "@/types"

export default function ActivitiesPage() {
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()

  const report = useQuery({
    queryKey: queryKeys.reportActivities(dateFrom, dateTo),
    queryFn: () => reportsApi.activities(dateFrom, dateTo),
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan Aktivitas"
        description="Pendapatan, beban, dan perubahan aset neto pada periode terpilih"
        actions={
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        }
      />

      <DataState
        framed
        isLoading={report.isLoading}
        isError={report.isError}
        error={report.error}
        onRetry={() => report.refetch()}
        isEmpty={!!report.data && report.data.pendapatan.length === 0 && report.data.beban.length === 0}
        emptyTitle="Belum ada aktivitas"
        emptyDescription="Laporan aktivitas akan tampil setelah ada transaksi terposting."
        rows={5}
      >
        {report.data ? <ActivitiesBody data={report.data} dateFrom={dateFrom} dateTo={dateTo} /> : null}
      </DataState>
    </div>
  )
}

function GroupTable({ group }: { group: ActivityGroup }) {
  const isIncome = group.type === "pendapatan"
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isIncome ? (
            <PlusIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <MinusIcon className="size-4 text-red-600 dark:text-red-400" />
          )}
          {group.label}
          {group.code ? <span className="font-mono text-xs text-muted-foreground">{group.code}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">No. Akun</TableHead>
              <TableHead>Akun</TableHead>
              <TableHead className="text-right">Debet</TableHead>
              <TableHead className="text-right">Kredit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.items.map((r) => (
              <TableRow key={r.account_id}>
                <TableCell className="font-mono text-sm">{r.code}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right">
                  {!isIncome ? <Amount value={r.amount} /> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  {isIncome ? <Amount value={r.amount} /> : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-medium">Jumlah {group.label.toLowerCase()}</TableCell>
              <TableCell className="text-right">{!isIncome ? <Amount value={group.total} /> : null}</TableCell>
              <TableCell className="text-right">{isIncome ? <Amount value={group.total} /> : null}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={3} className="font-medium">Surplus/(defisit) {group.label.toLowerCase()} periode</TableCell>
              <TableCell className="text-right">
                <Amount value={group.surplus} colored={group.surplus >= 0 ? "penerimaan" : "pengeluaran"} signed />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}

function ActivitiesBody({
  data,
  dateFrom,
  dateTo,
}: {
  data: ActivitiesReport
  dateFrom?: string
  dateTo?: string
}) {
  const totalPendapatan =
    data.total_pendapatan ?? data.pendapatan.reduce((acc, r) => acc + r.amount, 0)
  const totalBeban = data.total_beban ?? data.beban.reduce((acc, r) => acc + r.amount, 0)
  const netChange = data.net_change ?? totalPendapatan - totalBeban

  return (
    <>
      {(data.groups ?? []).map((g) => (
        <GroupTable key={g.key} group={g} />
      ))}
      <Card>
        <CardHeader>
          <CardTitle>Surplus/(Defisit) Dana Wakaf Periode</CardTitle>
          <CardDescription>
            {periodLabel(dateFrom, dateTo)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StatList>
            <StatRow label="Total Pendapatan">
              <Amount value={totalPendapatan} colored="penerimaan" />
            </StatRow>
            <StatRow label="Total Beban">
              <Amount value={-totalBeban} colored="pengeluaran" signed />
            </StatRow>
            <StatRow label="Surplus / Defisit" total>
              <Amount value={netChange} colored={netChange >= 0 ? "penerimaan" : "pengeluaran"} signed />
            </StatRow>
          </StatList>
        </CardContent>
      </Card>
    </>
  )
}
