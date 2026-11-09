import { XIcon } from "lucide-react"
import { DatePickerField } from "@/components/shared/DatePickerField"
import { Button } from "@/components/ui/button"

/** "Dari / Sampai" filter with a reset button once a date is set. */
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string | undefined
  to: string | undefined
  onFromChange: (v: string | undefined) => void
  onToChange: (v: string | undefined) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <DatePickerField className="w-44" label="Dari" value={from} onChange={onFromChange} />
      <DatePickerField className="w-44" label="Sampai" value={to} onChange={onToChange} />
      {from || to ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hapus filter tanggal"
          title="Hapus filter tanggal"
          onClick={() => {
            onFromChange(undefined)
            onToChange(undefined)
          }}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  )
}
