import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const [isDark, setIsDark] = React.useState(false)

  React.useEffect(() => {
    const update = () => {
      if (theme === "dark") setIsDark(true)
      else if (theme === "light") setIsDark(false)
      else setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches)
    }
    update()
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    mediaQuery.addEventListener("change", update)
    return () => mediaQuery.removeEventListener("change", update)
  }, [theme])

  return (
    <Button variant="outline" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")}>
      {isDark ? <Sun className="h-[1.2rem] w-[1.2rem]" /> : <Moon className="h-[1.2rem] w-[1.2rem]" />}
      <span className="sr-only">Alternar tema</span>
    </Button>
  )
}
