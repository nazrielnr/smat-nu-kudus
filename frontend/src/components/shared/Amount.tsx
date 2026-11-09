import { formatRupiah } from "@/lib/format"

interface AmountProps {
  value: number | null | undefined
  /** Color green for penerimaan, red for pengeluaran; default is neutral. */
  colored?: "penerimaan" | "pengeluaran" | "none"
  signed?: boolean
}

/** Renders integer rupiah with Indonesian locale, optional semantic coloring. */
export function Amount({ value, colored = "none", signed = false }: AmountProps) {
  const colorClass =
    colored === "penerimaan"
      ? "text-emerald-600 dark:text-emerald-400"
      : colored === "pengeluaran"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground"
  const display = value == null ? formatRupiah(0) : formatRupiah(signed ? Math.abs(value) : value)
  const sign = signed ? (value != null && value > 0 ? "+" : value != null && value < 0 ? "-" : "") : ""
  return (
    <span className={`tabular-nums font-medium ${colorClass}`}>
      {sign}
      {display}
    </span>
  )
}
