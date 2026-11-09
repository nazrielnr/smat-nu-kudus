import { format } from "date-fns"

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat("id-ID")

/** Format integer rupiah as "Rp 1.234.567". */
export function formatRupiah(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "Rp 0"
  return currencyFormatter.format(value).replace(/\s/g, " ")
}

/** Plain grouping (no currency symbol), e.g. 1.234.567. */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0"
  return numberFormatter.format(value)
}

/** Parse user input "1.234.567" or "1234567" into an integer. */
export function parseRupiahInput(input: string): number {
  const digits = input.replace(/[^\d]/g, "")
  if (digits === "") return 0
  return Number.parseInt(digits, 10)
}

const MONTHS_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
]

/** "2026-01" -> "Jan 2026" */
export function formatMonthLabel(month: string): string {
  const [year, mon] = month.split("-")
  const idx = Number.parseInt(mon ?? "1", 10) - 1
  return `${MONTHS_ID[idx] ?? mon} ${year}`
}

/** "2026-01-08" -> "8 Jan 2026" */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "-"
  const [year, mon, day] = date.slice(0, 10).split("-")
  const idx = Number.parseInt(mon ?? "1", 10) - 1
  return `${Number.parseInt(day ?? "1", 10)} ${MONTHS_ID[idx] ?? mon} ${year}`
}

/** ISO timestamp -> "8 Jan 2026 14:30" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return formatDate(iso)
  const date = format(d, "d MMM yyyy")
  const time = format(d, "HH:mm")
  return `${date} ${time}`
}

/** "Periode 1 Jan 2026 s.d. 31 Des 2026", or "Seluruh periode" when unfiltered. */
export function periodLabel(from?: string, to?: string): string {
  if (!from && !to) return "Seluruh periode"
  return `Periode ${from ? formatDate(from) : "awal"} s.d. ${to ? formatDate(to) : "sekarang"}`
}

/** Today / month start / year start as YYYY-MM-DD strings. */
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd")
}

export function monthStartISO(): string {
  const d = new Date()
  return format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd")
}

export function yearStartISO(): string {
  return `${new Date().getFullYear()}-01-01`
}
