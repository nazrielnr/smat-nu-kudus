import type { ReactNode } from "react"
import { AlertCircleIcon, InboxIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

export interface DataStateProps {
  isLoading: boolean
  isError?: boolean
  error?: Error | null
  isEmpty?: boolean
  /** Shows a "Coba lagi" button in the error state. */
  onRetry?: () => void
  /** Skeleton row count while loading. */
  rows?: number
  emptyIcon?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
  errorTitle?: string
  /** Wrap loading/error/empty states in their own Card (for pages whose content is several cards). */
  framed?: boolean
  children: ReactNode
}

/** One consistent loading / error / empty treatment for every data view. */
export function DataState({
  isLoading,
  isError = false,
  error,
  isEmpty = false,
  onRetry,
  rows = 6,
  emptyIcon,
  emptyTitle = "Belum ada data",
  emptyDescription,
  errorTitle = "Gagal memuat data",
  framed = false,
  children,
}: DataStateProps) {
  const frame = (node: ReactNode) =>
    framed ? (
      <Card>
        <CardContent>{node}</CardContent>
      </Card>
    ) : (
      node
    )

  if (isLoading) {
    return frame(
      <div className="flex flex-col gap-2" role="status" aria-label="Memuat data">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>,
    )
  }

  if (isError) {
    return frame(
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircleIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{errorTitle}</p>
          {error?.message ? <p className="text-sm text-muted-foreground">{error.message}</p> : null}
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCwIcon />
            Coba lagi
          </Button>
        ) : null}
      </div>,
    )
  }

  if (isEmpty) {
    return frame(
      <Empty className="min-h-48">
        <EmptyHeader>
          <EmptyMedia variant="icon">{emptyIcon ?? <InboxIcon />}</EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          {emptyDescription ? <EmptyDescription>{emptyDescription}</EmptyDescription> : null}
        </EmptyHeader>
      </Empty>,
    )
  }

  return <>{children}</>
}
