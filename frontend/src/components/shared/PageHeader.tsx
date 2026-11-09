import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { PrintButton } from "@/components/shared/PrintButton"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  backHref?: string
  className?: string
  /** Show the "Cetak / PDF" button (default true). */
  printable?: boolean
}

/** Judul halaman: judul + deskripsi di kiri, aksi di kanan, garis pemisah di bawah. */
export function PageHeader({ title, description, actions, backHref, className, printable = true }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <div className={cn("flex flex-col gap-4 print:block", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 print:block">
        <div className="flex items-center gap-3 print:block">
          {backHref ? (
            <Button variant="outline" size="icon-sm" aria-label="Kembali" onClick={() => navigate(backHref)}>
              <ArrowLeftIcon />
            </Button>
          ) : null}
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {actions || printable ? (
          <div className="flex flex-wrap items-center gap-2">
            {actions ? <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div> : null}
            {printable ? <PrintButton /> : null}
          </div>
        ) : null}
      </div>
      <Separator className="print:hidden" />
    </div>
  )
}
