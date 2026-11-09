import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { AmountCell } from "@/components/shared/AmountCell"
import { BalanceBadge } from "@/components/shared/BalanceBadge"
import { DatePickerField } from "@/components/shared/DatePickerField"
import { ReportCard } from "@/components/shared/ReportCard"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import type { AccountType } from "@/types"

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  aset: "Aset",
  liabilitas: "Liabilitas",
  aset_neto: "Aset Neto",
  pendapatan: "Pendapatan",
  beban: "Beban",
}

type Mode = "before" | "after"

export default function TrialBalancePage() {
  const [date, setDate] = useState<string | undefined>()
  const [mode, setMode] = useState<Mode>("before")

  const report = useQuery({
    queryKey: queryKeys.reportWorksheet(date),
    queryFn: () => reportsApi.worksheet(date),
  })

  // Saldo bersih per akun di sisi normalnya (format Excel); mode memilih sebelum/sesudah AJP.
  const before = mode === "before"
  const rows = (report.data?.rows ?? [])
    .map((r) => ({
      ...r,
      debit: before ? r.unadjusted_debit : r.adjusted_debit,
      credit: before ? r.unadjusted_credit : r.adjusted_credit,
    }))
    .filter((r) => r.debit > 0 || r.credit > 0)
  const totalDebit = rows.reduce((acc, r) => acc + r.debit, 0)
  const totalCredit = rows.reduce((acc, r) => acc + r.credit, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Neraca Saldo"
        description="Saldo bersih per akun pada sisi normalnya (debet / kredit)"
        actions={<DatePickerField className="w-44" value={date} onChange={setDate} label="Per Tanggal" />}
      />

      <ReportCard
        title={before ? "Neraca Saldo" : "Neraca Saldo Setelah Disesuaikan"}
        description={
          <div className="flex flex-col gap-2">
            <span>
              {before ? "Sebelum jurnal penyesuaian (AJP)" : "Sudah memuat jurnal penyesuaian (AJP)"}
            </span>
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="before">Sebelum penyesuaian</TabsTrigger>
                <TabsTrigger value="after">Setelah disesuaikan</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
        actions={
          rows.length > 0 ? (
            <BalanceBadge balanced={totalDebit === totalCredit} labelOk="Debit = Kredit" labelBad="Debit ≠ Kredit" />
          ) : null
        }
        isLoading={report.isLoading}
        isError={report.isError}
        error={report.error}
        onRetry={() => report.refetch()}
        isEmpty={rows.length === 0}
        emptyDescription="Neraca saldo akan tampil setelah ada jurnal terposting."
        rows={8}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">No. Akun</TableHead>
              <TableHead>Nama Akun</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead className="text-right">Debet</TableHead>
              <TableHead className="text-right">Kredit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.account_id}>
                <TableCell className="font-mono text-sm">{r.code}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[r.account_type] ?? r.account_type}</Badge>
                </TableCell>
                <AmountCell value={r.debit} />
                <AmountCell value={r.credit} />
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Jumlah</TableCell>
              <AmountCell value={totalDebit} dashZero={false} />
              <AmountCell value={totalCredit} dashZero={false} />
            </TableRow>
          </TableFooter>
        </Table>
      </ReportCard>
    </div>
  )
}
