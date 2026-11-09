import { Link, useLocation, useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { ChevronsUpDownIcon, LogOutIcon, MoonIcon, SettingsIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { useAuth } from "@/auth/auth-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { visibleNav } from "@/components/layout/nav"
import { usePendingApprovals } from "@/hooks/use-pending-approvals"
import { authApi } from "@/services/api"
import type { Role } from "@/types"

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  bendahara: "Bendahara",
  pemeriksa: "Pemeriksa",
  pengelola_aset: "Pengelola Aset",
  pimpinan: "Pimpinan",
}

export const roleLabel = (role: Role) => ROLE_LABELS[role] ?? role

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")

const isActivePath = (pathname: string, url: string) =>
  url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/")

/** Sidebar kiri shadcn: logo, grup menu, akun di bawah. */
export function AppSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pending = usePendingApprovals()
  const { resolvedTheme, setTheme } = useTheme()
  const { setOpenMobile } = useSidebar()
  const dark = resolvedTheme === "dark"

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: async (_d, err) => {
      await logout()
      if (!err) toast.success("Berhasil keluar")
      navigate("/login", { replace: true })
    },
  })

  return (
    <Sidebar side="left" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/" onClick={() => setOpenMobile(false)}>
                <img src="/logo.png" alt="Logo LWPNU" className="size-8 rounded-md bg-white object-contain p-0.5" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">SMAT NU Kudus</span>
                  <span className="truncate text-xs text-muted-foreground">Monitoring Aset Wakaf</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {user
          ? visibleNav(user.role).map((section) => {
              const leaves = section.leaf ? [section.leaf] : (section.items ?? [])
              return (
                <SidebarGroup key={section.label}>
                  {section.leaf ? null : <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {leaves.map((l) => (
                        <SidebarMenuItem key={l.url}>
                          <SidebarMenuButton asChild isActive={isActivePath(pathname, l.url)} tooltip={l.title}>
                            <Link to={l.url} onClick={() => setOpenMobile(false)}>
                              <l.icon />
                              <span>{l.title}</span>
                            </Link>
                          </SidebarMenuButton>
                          {l.url === "/persetujuan" && pending > 0 ? <SidebarMenuBadge>{pending}</SidebarMenuBadge> : null}
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )
            })
          : null}
      </SidebarContent>

      <SidebarFooter>
        {user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <Avatar className="size-8">
                      <AvatarFallback>{initials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{roleLabel(user.role)}</span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-sm font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTheme(dark ? "light" : "dark")}>
                    {dark ? <SunIcon /> : <MoonIcon />}
                    {dark ? "Mode terang" : "Mode gelap"}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings"><SettingsIcon />Pengaturan</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" disabled={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>
                    <LogOutIcon />Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
