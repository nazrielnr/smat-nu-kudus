import type { ReactNode } from "react"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataState, type DataStateProps } from "@/components/shared/DataState"

interface ReportCardProps extends Omit<DataStateProps, "framed"> {
  title: string
  description?: ReactNode
  /** Right side of the card header (status badge, buttons). */
  actions?: ReactNode
  /** Rendered below the content when data is available. */
  footer?: ReactNode
}

/** Card + header + DataState: the standard container for a report or table. */
export function ReportCard({ title, description, actions, footer, children, ...state }: ReportCardProps) {
  const showFooter = !state.isLoading && !state.isError && !state.isEmpty
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {actions ? <CardAction>{actions}</CardAction> : null}
      </CardHeader>
      <CardContent>
        <DataState {...state}>{children}</DataState>
        {showFooter && footer ? <div className="pt-3">{footer}</div> : null}
      </CardContent>
    </Card>
  )
}
