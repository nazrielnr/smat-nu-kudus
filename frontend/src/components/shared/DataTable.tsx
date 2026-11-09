import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { SearchIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataState } from "@/components/shared/DataState"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
  key: string
  header: string
  className?: string
  /** Mobile card view: render this field across the full card width (auto for long-text headers). */
  mobileFull?: boolean
  render: (row: T) => ReactNode
}

const FULL_WIDTH_HEADER = /deskripsi|keterangan|alamat|catatan|lokasi|uraian|nama aset|aksi/i

interface DataTableProps<T> {
  title?: string
  description?: string
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  isLoading?: boolean
  error?: string | null
  emptyTitle?: string
  emptyDescription?: string
  /** Shows a retry button in the error state. */
  onRetry?: () => void
  onRowClick?: (row: T) => void
  toolbar?: ReactNode
  searchPlaceholder?: string
  /** Client-side search predicate; omit to disable the search box. */
  searchPredicate?: (row: T, query: string) => boolean
  actions?: ReactNode
  /** Server-side pagination info. Omit for client-side pagination. */
  page?: number
  totalPages?: number
  total?: number
  onPageChange?: (page: number) => void
  /** Fallback client-side page size when server info is absent. */
  pageSize?: number
  skeletonRows?: number
  className?: string
}

function windowedPages(current: number, total: number): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = []
  const show = 5
  const start = Math.max(1, Math.min(current - 2, total - show + 1))
  const end = Math.min(total, start + show - 1)
  for (let p = 1; p <= total; p += 1) {
    if (p === 1 || p === total || (p >= start && p <= end)) {
      pages.push(p)
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis")
    }
  }
  return pages
}

export function DataTable<T>({
  title,
  description,
  columns,
  rows,
  rowKey,
  isLoading = false,
  error = null,
  emptyTitle = "Belum ada data",
  emptyDescription = "Data akan tampil di sini setelah tersedia.",
  onRetry,
  onRowClick,
  toolbar,
  searchPlaceholder,
  searchPredicate,
  actions,
  page,
  totalPages,
  total,
  onPageChange,
  pageSize = 10,
  skeletonRows = 6,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("")
  const [localPage, setLocalPage] = useState(1)

  const filtered = useMemo(() => {
    if (!searchPredicate || query.trim() === "") return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) => searchPredicate(row, q))
  }, [rows, query, searchPredicate])

  const isServerPaginated = totalPages != null && onPageChange != null
  const effectivePage = isServerPaginated ? (page ?? 1) : localPage
  const effectiveTotalPages = isServerPaginated
    ? Math.max(1, totalPages ?? 1)
    : Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleRows = isServerPaginated ? filtered : filtered.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

  useEffect(() => {
    if (!isServerPaginated && localPage > effectiveTotalPages) {
      setLocalPage(1)
    }
  }, [isServerPaginated, localPage, effectiveTotalPages])

  const goToPage = (p: number) => {
    if (isServerPaginated) onPageChange?.(p)
    else setLocalPage(p)
  }

  const controls =
    searchPredicate || toolbar || actions ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {searchPredicate ? (
          <div className="relative w-full sm:ml-auto sm:max-w-64 sm:order-last">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (!isServerPaginated) setLocalPage(1)
              }}
              placeholder={searchPlaceholder ?? "Cari..."}
              aria-label={searchPlaceholder ?? "Cari"}
              className="pl-9"
            />
          </div>
        ) : null}
        {toolbar ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2 sm:flex sm:flex-wrap max-sm:[&_[data-slot=select-trigger]]:w-full">
            {toolbar}
          </div>
        ) : null}
        {actions}
      </div>
    ) : null

  return (
    <Card className={cn("@container/card", className)}>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
          {controls ? <div className="pt-2">{controls}</div> : null}
        </CardHeader>
      ) : controls ? (
        <CardHeader className="pb-0">{controls}</CardHeader>
      ) : null}
      <CardContent>
        <DataState
          isLoading={isLoading && !error}
          isError={!!error}
          error={error ? new Error(error) : null}
          onRetry={onRetry}
          isEmpty={visibleRows.length === 0}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          rows={skeletonRows}
        >
          <>
            {/* Mobile: one card per row. Desktop (and print): regular table. */}
            <ul className="flex flex-col gap-3 md:hidden print:hidden">
              {visibleRows.map((row) => {
                const [primary, ...rest] = columns
                const fields = rest.filter((c) => c.header)
                const extras = rest.filter((c) => !c.header)
                return (
                  <li
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "rounded-2xl border bg-muted/30 p-4 transition-colors",
                      onRowClick && "cursor-pointer active:bg-accent/60",
                    )}
                  >
                    <div className="min-w-0 text-[0.95rem] font-medium">{primary.render(row)}</div>
                    {fields.length > 0 ? (
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        {fields.map((col) => (
                          <div
                            key={col.key}
                            className={cn(
                              "min-w-0",
                              (col.mobileFull ?? FULL_WIDTH_HEADER.test(col.header)) && "col-span-2",
                            )}
                          >
                            <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{col.header}</dt>
                            <dd className="mt-0.5 break-words">{col.render(row)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {extras.length > 0 ? (
                      <div className="mt-3 flex justify-end gap-2 border-t pt-3">
                        {extras.map((col) => (
                          <span key={col.key}>{col.render(row)}</span>
                        ))}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            <div className="hidden md:block print:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.key} className={col.className}>
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    className={onRowClick ? "cursor-pointer" : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            {effectiveTotalPages > 1 ? (
              <div className="flex flex-col items-center gap-2 pt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => goToPage(Math.max(1, effectivePage - 1))}
                        aria-disabled={effectivePage <= 1}
                        className={effectivePage <= 1 ? "pointer-events-none opacity-50" : undefined}
                      />
                    </PaginationItem>
                    {windowedPages(effectivePage, effectiveTotalPages).map((p, idx) =>
                      p === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${idx}`} className="max-sm:hidden">
                          <span className="px-2 text-muted-foreground">…</span>
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p} className={p === effectivePage ? undefined : "max-sm:hidden"}>
                          <PaginationLink
                            isActive={p === effectivePage}
                            onClick={() => goToPage(p)}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => goToPage(Math.min(effectiveTotalPages, effectivePage + 1))}
                        aria-disabled={effectivePage >= effectiveTotalPages}
                        className={effectivePage >= effectiveTotalPages ? "pointer-events-none opacity-50" : undefined}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <p className="text-xs text-muted-foreground">
                  {total != null
                    ? `Total ${total.toLocaleString("id-ID")} data`
                    : `Menampilkan ${(effectivePage - 1) * pageSize + 1}–${Math.min(effectivePage * pageSize, filtered.length)} dari ${filtered.length} data`}
                </p>
              </div>
            ) : null}
          </>
        </DataState>
      </CardContent>
    </Card>
  )
}

