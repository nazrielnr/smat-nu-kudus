import { PrinterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Opens the browser print dialog; choose "Simpan sebagai PDF" there to export a PDF. */
export function PrintButton({ label = "Cetak / PDF" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="print:hidden"
      title="Cetak halaman ini atau simpan sebagai PDF"
      onClick={() => window.print()}
    >
      <PrinterIcon />
      {label}
    </Button>
  )
}
