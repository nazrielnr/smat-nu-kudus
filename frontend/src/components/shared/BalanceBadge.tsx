import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Pill that tells at a glance whether a report balances. */
export function BalanceBadge({
  balanced,
  labelOk = "Seimbang",
  labelBad = "Tidak seimbang",
  className,
}: {
  balanced: boolean
  labelOk?: string
  labelBad?: string
  className?: string
}) {
  const Icon = balanced ? CircleCheckIcon : CircleAlertIcon
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        balanced
          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          : "bg-red-500/12 text-red-700 dark:text-red-300",
        className,
      )}
    >
      <Icon className="size-3.5" />
      {balanced ? labelOk : labelBad}
    </span>
  )
}
