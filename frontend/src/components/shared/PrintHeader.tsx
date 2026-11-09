import { useQuery } from "@tanstack/react-query"
import { settingsApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import { formatDate, todayISO } from "@/lib/format"

/** Kop surat (logo kiri + nama sistem) yang hanya tampil saat dicetak / disimpan sebagai PDF. */
export function PrintHeader() {
  const org = useQuery({ queryKey: queryKeys.orgName, queryFn: () => settingsApi.org(), staleTime: Infinity })
  return (
    <div className="hidden print:block">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="Logo LWPNU" className="size-14 shrink-0 object-contain" />
        <div className="flex flex-col leading-tight">
          <p className="text-[16pt] font-bold uppercase">SMAT NU Kudus</p>
          <p className="text-[10pt]">Sistem Monitoring Aset Wakaf dan Tanah Nahdlatul Ulama Kabupaten Kudus</p>
          {org.data?.name ? <p className="text-[10pt] font-semibold">{org.data.name}</p> : null}
        </div>
      </div>
      <div className="mt-2 border-t-2 border-b border-black pt-px" />
      <p className="pt-1 text-right text-[8.5pt] italic">Dicetak {formatDate(todayISO())}</p>
    </div>
  )
}
