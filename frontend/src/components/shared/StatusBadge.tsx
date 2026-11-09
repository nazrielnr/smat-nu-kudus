import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AssetStatus, TransactionStatus } from "@/types"

const STATUS_LABELS: Record<TransactionStatus, string> = {
  draft: "Draft",
  menunggu_persetujuan: "Menunggu Persetujuan",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  diposting: "Diposting",
  dibatalkan: "Dibatalkan",
}

type Tone = "slate" | "amber" | "emerald" | "red" | "sky"

const TONE: Record<Tone, { badge: string; dot: string }> = {
  slate: {
    badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  amber: {
    badge: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  emerald: {
    badge: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  red: {
    badge: "bg-red-500/10 text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
  sky: {
    badge: "bg-sky-500/12 text-sky-800 dark:text-sky-300",
    dot: "bg-sky-500",
  },
}

const STATUS_TONE: Record<TransactionStatus, Tone> = {
  draft: "slate",
  menunggu_persetujuan: "amber",
  disetujui: "emerald",
  ditolak: "red",
  diposting: "sky",
  dibatalkan: "red",
}

function ToneBadge({ tone, children, className }: { tone: Tone; children: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent", TONE[tone].badge, className)}>
      <span className={cn("size-1.5 rounded-full", TONE[tone].dot)} />
      {children}
    </Badge>
  )
}

export function StatusBadge({
  status,
  className,
}: {
  status: TransactionStatus
  className?: string
}) {
  return (
    <ToneBadge tone={STATUS_TONE[status] ?? "slate"} className={className}>
      {STATUS_LABELS[status] ?? status}
    </ToneBadge>
  )
}

const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  aktif: "Aktif",
  tidak_aktif: "Tidak Aktif",
  dihapuskan: "Dihapuskan",
}

const ASSET_TONE: Record<AssetStatus, Tone> = {
  aktif: "emerald",
  tidak_aktif: "slate",
  dihapuskan: "red",
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return <ToneBadge tone={ASSET_TONE[status] ?? "slate"}>{ASSET_STATUS_LABELS[status] ?? status}</ToneBadge>
}

export function statusLabel(status: TransactionStatus): string {
  return STATUS_LABELS[status] ?? status
}
