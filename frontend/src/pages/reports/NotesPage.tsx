import { useQuery } from "@tanstack/react-query"
import { FileTextIcon } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataState } from "@/components/shared/DataState"
import { Separator } from "@/components/ui/separator"
import { normalizeList, reportsApi } from "@/services/api"
import { queryKeys } from "@/services/query-keys"
import type { NoteItem } from "@/types"

export default function NotesPage() {
  const notes = useQuery({
    queryKey: queryKeys.reportNotes,
    queryFn: () => reportsApi.notes(),
  })

  const items: NoteItem[] = normalizeList(notes.data)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Catatan atas Laporan Keuangan (CALK)"
        description="Catatan penjelas atas laporan keuangan SMAT NU Kudus"
      />

      <DataState
        framed
        isLoading={notes.isLoading}
        isError={notes.isError}
        error={notes.error}
        onRetry={() => notes.refetch()}
        isEmpty={items.length === 0}
        emptyIcon={<FileTextIcon />}
        emptyTitle="Belum ada catatan"
        emptyDescription="Catatan atas laporan keuangan akan tampil di sini."
        rows={3}
      >
        <div className="flex flex-col gap-4">
          {items.map((note, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="text-base">
                  {idx + 1}. {note.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm whitespace-pre-line text-foreground/80">
                  {note.content}
                </CardDescription>
                {idx < items.length - 1 ? <Separator className="mt-4" /> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </DataState>
    </div>
  )
}
