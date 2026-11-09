import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { AmountCell } from "@/components/shared/AmountCell"
import { DataState } from "@/components/shared/DataState"
import { DatePickerField } from "@/components/shared/DatePickerField"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { accountsApi, ledgerApi, normalizeList } from "@/services/api"
import { normalizePaginated } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate, periodLabel } from "@/lib/format"

export default function LedgerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const accountId = searchParams.get("account_id") ?? ""
  const [dateFrom, setDateFrom] = useState<string | undefined>(searchParams.get("date_from") ?? undefined)
  const [dateTo, setDateTo] = useState<string | undefined>(searchParams.get("date_to") ?? undefined)

  const accounts = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: () => accountsApi.list(),
  })

  const ledger = useQuery({
    queryKey: queryKeys.ledger({ account_id: accountId, date_from: dateFrom, date_to: dateTo }),
    queryFn: () => ledgerApi.get({ account_id: accountId, date_from: dateFrom, date_to: dateTo }),
    enabled: accountId !== "",
  })

  const accountItems = normalizeList(accounts.data)
  const selectedAccount = accountItems.find((a) => a.id === accountId)
  const paginated = normalizePaginated(ledger.data, 1, 200)
  const entries = paginated.items.map((e) => ({
    ...e,
    journal_date: e.entry_date ?? e.journal_date,
    balance: e.running_balance ?? e.balance,
  }))

  const setAccount = (id: string) => {
    const next = new URLSearchParams(searchParams)
    if (id) next.set("account_id", id)
    else next.delete("account_id")
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buku Besar"
        description="Mutasi dan saldo berjalan per akun"
      />

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Filter Buku Besar</CardTitle>
          <CardDescription>Pilih akun dan rentang tanggal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Akun</label>
              <Select value={accountId} onValueChange={(v) => setAccount(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih akun" />
                </SelectTrigger>
                <SelectContent>
                  {accountItems.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DatePickerField label="Dari Tanggal" value={dateFrom} onChange={setDateFrom} />
            <DatePickerField label="Sampai Tanggal" value={dateTo} onChange={setDateTo} />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom(undefined)
                  setDateTo(undefined)
                  setAccount(accountId)
                }}
              >
                Reset Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedAccount
              ? `Buku Besar: ${selectedAccount.code} — ${selectedAccount.name}`
              : "Buku Besar"}
          </CardTitle>
          <CardDescription>
            {periodLabel(dateFrom, dateTo)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataState
            isLoading={accountId !== "" && ledger.isLoading}
            isError={accountId !== "" && ledger.isError}
            error={ledger.error}
            onRetry={() => ledger.refetch()}
            isEmpty={accountId === "" || entries.length === 0}
            emptyTitle={accountId === "" ? "Pilih akun terlebih dahulu" : "Belum ada mutasi"}
            emptyDescription={
              accountId === ""
                ? "Pilih akun pada filter di atas untuk melihat mutasi buku besar."
                : "Akun ini belum memiliki transaksi pada periode terpilih."
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Nomor Jurnal</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Kredit</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={`${e.journal_id}-${e.journal_date}-${e.debit}-${e.credit}`}>
                    <TableCell>{formatDate(e.journal_date)}</TableCell>
                    <TableCell>
                      <Link
                        to={`/journals/${e.journal_id}`}
                        className="font-mono text-sm text-primary underline-offset-4 hover:underline"
                      >
                        {e.journal_number}
                      </Link>
                    </TableCell>
                    <TableCell>{e.description ?? "-"}</TableCell>
                    <AmountCell value={e.debit} />
                    <AmountCell value={e.credit} />
                    <AmountCell value={e.balance} dashZero={false} />
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>Saldo Akhir</TableCell>
                  <AmountCell value={entries[entries.length - 1]?.balance ?? 0} dashZero={false} />
                </TableRow>
              </TableFooter>
            </Table>
          </DataState>
        </CardContent>
      </Card>
    </div>
  )
}
