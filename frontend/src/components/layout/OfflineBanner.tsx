import { useSyncExternalStore } from "react"
import { WifiOffIcon } from "lucide-react"

function subscribe(cb: () => void) {
  window.addEventListener("online", cb)
  window.addEventListener("offline", cb)
  return () => {
    window.removeEventListener("online", cb)
    window.removeEventListener("offline", cb)
  }
}

/** Slim notice shown when the device loses its connection. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
  if (online) return null
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-1.5 text-xs font-medium text-amber-800 print:hidden dark:text-amber-300"
    >
      <WifiOffIcon className="size-3.5" />
      Anda sedang offline. Data terbaru tidak dapat dimuat.
    </div>
  )
}
