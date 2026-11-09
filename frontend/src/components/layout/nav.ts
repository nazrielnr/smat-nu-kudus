import {
  BanknoteIcon,
  BookOpenIcon,
  Building2Icon,
  ClipboardCheckIcon,
  FileTextIcon,
  HandCoinsIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  type LucideIcon,
  PiggyBankIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"
import type { Role } from "@/types"

export interface NavLeaf {
  title: string
  url: string
  icon: LucideIcon
  roles: Role[]
}

export interface NavSection {
  label: string
  /** Direct link (no dropdown). */
  leaf?: NavLeaf
  items?: NavLeaf[]
  /** Extra path prefixes that should mark this section active. */
  extraPrefixes?: string[]
}

const ALL: Role[] = ["admin", "bendahara", "pengelola_aset", "pemeriksa", "pimpinan"]

export const NAV: NavSection[] = [
  { label: "Beranda", leaf: { title: "Beranda", url: "/", icon: LayoutDashboardIcon, roles: ALL } },
  {
    label: "Keuangan",
    extraPrefixes: ["/transactions"],
    items: [
      { title: "Data Wakif", url: "/wakif", icon: UsersIcon, roles: ["admin", "bendahara", "pemeriksa"] },
      { title: "Dana Masuk", url: "/penerimaan", icon: HandCoinsIcon, roles: ["admin", "bendahara", "pemeriksa", "pimpinan"] },
      { title: "Dana Keluar", url: "/pengeluaran", icon: BanknoteIcon, roles: ["admin", "bendahara", "pemeriksa", "pimpinan"] },
      { title: "Persetujuan", url: "/persetujuan", icon: ClipboardCheckIcon, roles: ["admin", "pemeriksa", "pimpinan"] },
    ],
  },
  {
    label: "Aset",
    leaf: { title: "Data Aset", url: "/assets", icon: LandmarkIcon, roles: ["admin", "pengelola_aset", "pemeriksa"] },
  },
  {
    label: "Pembukuan",
    items: [
      { title: "Daftar Akun", url: "/accounts", icon: LibraryIcon, roles: ["admin", "bendahara", "pemeriksa"] },
      { title: "Jurnal", url: "/journals", icon: BookOpenIcon, roles: ["admin", "bendahara", "pemeriksa"] },
      { title: "Buku Besar", url: "/ledger", icon: ScrollTextIcon, roles: ["admin", "bendahara", "pemeriksa"] },
      { title: "Saldo Akun", url: "/trial-balance", icon: Building2Icon, roles: ["admin", "bendahara", "pemeriksa"] },
      { title: "Lembar Kerja", url: "/reports/worksheet", icon: ScrollTextIcon, roles: ["admin", "bendahara", "pemeriksa"] },
    ],
  },
  {
    label: "Laporan",
    items: [
      { title: "Neraca", url: "/reports/financial-position", icon: FileTextIcon, roles: ["admin", "bendahara", "pemeriksa", "pimpinan"] },
      { title: "Daftar Aset Wakaf", url: "/reports/waqf-assets", icon: LandmarkIcon, roles: ["admin", "bendahara", "pemeriksa", "pimpinan"] },
      { title: "Aktivitas", url: "/reports/activities", icon: PiggyBankIcon, roles: ["admin", "bendahara", "pemeriksa", "pimpinan"] },
      { title: "Aset Kelolaan", url: "/reports/managed-assets", icon: LandmarkIcon, roles: ["admin", "bendahara", "pemeriksa", "pimpinan"] },
      { title: "Arus Kas", url: "/reports/cash-flow", icon: BanknoteIcon, roles: ["admin", "bendahara", "pemeriksa", "pimpinan"] },
      { title: "Catatan Laporan", url: "/reports/notes", icon: FileTextIcon, roles: ["admin", "bendahara", "pemeriksa", "pimpinan"] },
    ],
  },
  {
    label: "Sistem",
    items: [
      { title: "Riwayat Perubahan", url: "/audit-logs", icon: ShieldCheckIcon, roles: ["admin", "pemeriksa"] },
      { title: "Pengguna", url: "/users", icon: UsersIcon, roles: ["admin"] },
      { title: "Pengaturan", url: "/settings", icon: SettingsIcon, roles: ALL },
    ],
  },
]

export interface VisibleSection extends Omit<NavSection, "items" | "leaf"> {
  leaf?: NavLeaf
  items?: NavLeaf[]
}

export function visibleNav(role: Role): VisibleSection[] {
  const out: VisibleSection[] = []
  for (const s of NAV) {
    if (s.leaf) {
      if (s.leaf.roles.includes(role)) out.push(s)
    } else {
      const items = (s.items ?? []).filter((i) => i.roles.includes(role))
      if (items.length) out.push({ ...s, items })
    }
  }
  return out
}

export function isSectionActive(s: VisibleSection, pathname: string): boolean {
  const urls = s.leaf ? [s.leaf.url] : (s.items ?? []).map((i) => i.url)
  const hit = (u: string) => (u === "/" ? pathname === "/" : pathname === u || pathname.startsWith(u + "/"))
  return urls.some(hit) || (s.extraPrefixes ?? []).some(hit)
}
