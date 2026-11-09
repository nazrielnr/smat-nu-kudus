import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Label/value rows for report summaries and totals. */
export function StatList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("flex flex-col gap-3", className)}>{children}</dl>
}

export function StatRow({
  label,
  children,
  total = false,
}: {
  label: ReactNode
  children: ReactNode
  /** Emphasised closing row with a top rule. */
  total?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 text-sm",
        total && "border-t pt-3 text-base font-semibold",
      )}
    >
      <dt className={total ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}
