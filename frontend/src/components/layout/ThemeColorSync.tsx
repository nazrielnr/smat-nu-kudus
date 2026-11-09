import { useEffect } from "react"
import { useTheme } from "next-themes"

/** Keeps the browser/status-bar colour in step with the active theme (PWA). */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute("content", resolvedTheme === "light" ? "#ffffff" : "#0a0a0a")
  }, [resolvedTheme])
  return null
}
