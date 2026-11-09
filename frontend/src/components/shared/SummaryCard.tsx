import type { ReactNode } from "react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface SummaryCardProps {
  title: string
  value: string
  description?: string
  icon?: ReactNode
  trend?: "up" | "down" | "neutral"
  className?: string
  loading?: boolean
  /** Dipertahankan agar pemanggil lama tetap valid; tidak lagi dipakai. */
  tone?: "primary" | "gold" | "sky" | "violet"
}

/** Kartu ringkasan shadcn standar (pola "section cards"). */
export function SummaryCard({ title, value, description, icon, trend = "neutral", className, loading = false }: SummaryCardProps) {
  const trendColor =
    trend === "up" ? "text-foreground" : trend === "down" ? "text-destructive" : "text-muted-foreground"
  return (
    <Card className={cn("@container/card", className)}>
      <CardHeader>
        <CardDescription className="flex items-center justify-between gap-2">
          {title}
          {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[220px]/card:text-3xl">
          {loading ? <Skeleton className="h-8 w-36" /> : value}
        </CardTitle>
        {description ? <p className={cn("text-xs", trendColor)}>{description}</p> : null}
      </CardHeader>
    </Card>
  )
}
