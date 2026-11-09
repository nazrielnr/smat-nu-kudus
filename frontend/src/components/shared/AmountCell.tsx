import { Amount } from "@/components/shared/Amount"
import { TableCell } from "@/components/ui/table"

/** Right-aligned money cell; zero renders as a muted dash unless `dashZero` is false. */
export function AmountCell({
  value,
  dashZero = true,
  colored,
  signed,
  className,
  ...props
}: {
  value: number | null | undefined
  dashZero?: boolean
  colored?: "penerimaan" | "pengeluaran" | "none"
  signed?: boolean
  className?: string
} & Omit<React.ComponentProps<"td">, "children">) {
  const empty = dashZero && (value == null || value === 0)
  return (
    <TableCell className={["text-right", className].filter(Boolean).join(" ")} {...props}>
      {empty ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <Amount value={value} colored={colored} signed={signed} />
      )}
    </TableCell>
  )
}
