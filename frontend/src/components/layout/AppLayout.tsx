import { Outlet, useLocation } from "react-router-dom"
import { AppSidebar } from "@/components/layout/Header"
import { OfflineBanner } from "@/components/layout/OfflineBanner"
import { NAV } from "@/components/layout/nav"
import { PrintHeader } from "@/components/shared/PrintHeader"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

// Halaman dengan kolom lebar dicetak landscape (kop ikut di halaman yang sama).
const LANDSCAPE_PATHS = ["/reports/worksheet", "/reports/managed-assets"]

export function AppLayout() {
  const { pathname } = useLocation()
  const landscape = LANDSCAPE_PATHS.includes(pathname)
  const title =
    NAV.flatMap((s) => (s.leaf ? [s.leaf] : (s.items ?? []))).find((l) =>
      l.url === "/" ? pathname === "/" : pathname === l.url || pathname.startsWith(l.url + "/")
    )?.title ?? "Beranda"
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <OfflineBanner />
        <header data-slot="app-topbar" className="flex h-12 shrink-0 items-center gap-2 border-b px-4 print:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm text-muted-foreground">{title}</span>
        </header>
        <main data-slot="app-main" className="flex-1 p-4 md:p-6">
          <div className={`mx-auto flex w-full max-w-7xl flex-col gap-6${landscape ? " print-landscape" : ""}`}>
            <PrintHeader />
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
