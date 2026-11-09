import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  BanknoteIcon,
  ClipboardCheckIcon,
  HandCoinsIcon,
  LandmarkIcon,
  PlusIcon,
  WalletIcon,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useAuth } from "@/auth/auth-context"
import { Amount } from "@/components/shared/Amount"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { SummaryCard } from "@/components/shared/SummaryCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dashboardApi, normalizeList } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate, formatMonthLabel, formatRupiah } from "@/lib/format"
import type { Transaction } from "@/types"

const chartConfig = {
  penerimaan: { label: "Penerimaan", color: "var(--chart-1)" },
  pengeluaran: { label: "Pengeluaran", color: "var(--chart-2)" },
} satisfies ChartConfig

const RANGES = [3, 6, 12] as const

function compactRupiah(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1).replace(".", ",")}M`
  if (abs >= 1e6) return `${Math.round(v / 1e6)}jt`
  if (abs >= 1e3) return `${Math.round(v / 1e3)}rb`
  return String(v)
}

/** Pusat Kerja: tugas dulu (persetujuan, aksi cepat), angka ringkas, lalu tren & aktivitas. */
export default function DashboardPage() {
  const { user } = useAuth()
  const [months, setMonths] = useState<(typeof RANGES)[number]>(6)

  const summary = useQuery({ queryKey: queryKeys.dashboardSummary, queryFn: () => dashboardApi.summary() })
  const recent = useQuery({ queryKey: queryKeys.dashboardTransactions(10), queryFn: () => dashboardApi.transactions(10) })
  const cashFlow = useQuery({ queryKey: queryKeys.dashboardCashFlow(months), queryFn: () => dashboardApi.cashFlow(months) })
  const assetsDist = useQuery({ queryKey: queryKeys.dashboardAssets, queryFn: () => dashboardApi.assets() })

  const s = summary.data
  const loading = summary.isLoading
  const pending = s?.transaksi_menunggu_persetujuan ?? s?.pending_transactions ?? s?.pending_approval_count ?? 0
  const canApprove = !!user && ["admin", "pemeriksa", "pimpinan", "bendahara"].includes(user.role)
  const canTransact = !!user && ["admin", "bendahara"].includes(user.role)
  const canAsset = !!user && ["admin", "pengelola_aset"].includes(user.role)

  const recentItems: Transaction[] = normalizeList(recent.data)
  const chartData = normalizeList(cashFlow.data).map((p) => ({
    month: formatMonthLabel(p.month).split(" ")[0],
    penerimaan: p.penerimaan,
    pengeluaran: p.pengeluaran,
  }))
  const assetItems = normalizeList(assetsDist.data)
  const assetTotal = assetItems.reduce((a, x) => a + x.total_value, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Halo, {user?.name ?? "Pengguna"}</h1>
          <p className="text-sm text-muted-foreground">Pusat kerja monitoring aset wakaf NU Kudus.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canTransact ? (
            <>
              <Button asChild size="sm">
                <Link to="/penerimaan/new"><PlusIcon />Penerimaan</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/pengeluaran/new"><PlusIcon />Pengeluaran</Link>
              </Button>
            </>
          ) : null}
          {canAsset ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/assets/new"><PlusIcon />Aset</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {canApprove && pending > 0 ? (
        <Alert>
          <ClipboardCheckIcon />
          <AlertTitle>{pending} transaksi menunggu persetujuan</AlertTitle>
          <AlertDescription>
            <Link to="/persetujuan" className="underline underline-offset-4">Tinjau sekarang</Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Saldo Kas" value={formatRupiah(s?.saldo_kas ?? 0)} icon={<WalletIcon />} loading={loading} />
        <SummaryCard title="Total Penerimaan" value={formatRupiah(s?.total_penerimaan ?? 0)} icon={<HandCoinsIcon />} loading={loading} />
        <SummaryCard title="Total Pengeluaran" value={formatRupiah(s?.total_pengeluaran ?? 0)} icon={<BanknoteIcon />} loading={loading} />
        <SummaryCard title="Aset Wakaf" value={formatRupiah(s?.total_aset_wakaf ?? 0)} icon={<LandmarkIcon />} loading={loading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Arus Kas</CardTitle>
              <CardDescription>Penerimaan vs pengeluaran per bulan</CardDescription>
            </div>
            <Tabs value={String(months)} onValueChange={(v) => setMonths(Number(v) as (typeof RANGES)[number])}>
              <TabsList>
                {RANGES.map((m) => (
                  <TabsTrigger key={m} value={String(m)}>{m} bln</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <AreaChart data={chartData} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={compactRupiah} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      formatter={(value, name) => (
                        <span className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span>
                          <span className="font-medium tabular-nums">{formatRupiah(Number(value))}</span>
                        </span>
                      )}
                    />
                  }
                />
                <Area dataKey="penerimaan" type="monotone" fill="var(--color-penerimaan)" fillOpacity={0.2} stroke="var(--color-penerimaan)" />
                <Area dataKey="pengeluaran" type="monotone" fill="var(--color-pengeluaran)" fillOpacity={0.2} stroke="var(--color-pengeluaran)" />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aset per Jenis</CardTitle>
            <CardDescription>Porsi nilai aset wakaf</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {assetItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data aset.</p>
            ) : (
              assetItems.map((a) => {
                const share = assetTotal > 0 ? (a.total_value / assetTotal) * 100 : 0
                return (
                  <div key={a.asset_type} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{a.asset_type.replace(/_/g, " ")} <span className="text-muted-foreground">({a.count})</span></span>
                      <span className="tabular-nums text-muted-foreground">{Math.round(share)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Aktivitas Terbaru</CardTitle>
            <CardDescription>10 transaksi terakhir</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/penerimaan">Semua transaksi</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>No.</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada transaksi.</TableCell>
                </TableRow>
              ) : (
                recentItems.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.transaction_date)}</TableCell>
                    <TableCell>
                      <Link to={`/transactions/${t.id}`} className="underline-offset-4 hover:underline">
                        {t.transaction_number}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-64 truncate">{t.description}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Amount value={t.amount} colored={t.transaction_type} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
