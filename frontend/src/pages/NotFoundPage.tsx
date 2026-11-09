import { useNavigate } from "react-router-dom"
import { FileQuestionIcon, HomeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Empty className="min-h-64">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon />
          </EmptyMedia>
          <EmptyTitle>Halaman tidak ditemukan</EmptyTitle>
          <EmptyDescription>
            Halaman yang Anda tuju tidak tersedia atau telah dipindahkan.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => navigate("/")}>
            <HomeIcon />
            Kembali ke Dashboard
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
