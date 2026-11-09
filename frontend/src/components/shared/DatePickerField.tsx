import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldControl, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DatePickerFieldProps {
  value: string | undefined // YYYY-MM-DD
  onChange: (value: string) => void
  label?: string
  error?: string
  placeholder?: string
  disabled?: boolean
  /** Applied to the field wrapper, e.g. "w-44" for compact header filters. */
  className?: string
}

export function DatePickerField({
  value,
  onChange,
  label,
  error,
  placeholder = "Pilih tanggal",
  disabled = false,
  className,
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? new Date(`${value}T00:00:00`) : undefined

  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <FieldControl>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger disabled={disabled} asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 w-full justify-start gap-2 px-2.5 font-normal",
                !value && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
              {selected && !Number.isNaN(selected.getTime())
                ? format(selected, "d MMM yyyy")
                : placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(date) => {
                if (date) {
                  onChange(format(date, "yyyy-MM-dd"))
                  setOpen(false)
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </FieldControl>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

/** Text input restricted to YYYY-MM-DD (fallback for strict date entry). */
export function DateInputField({
  value,
  onChange,
  label,
  error,
}: {
  value: string | undefined
  onChange: (value: string) => void
  label?: string
  error?: string
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <FieldControl>
        <Input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </FieldControl>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
