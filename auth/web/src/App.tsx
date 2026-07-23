import * as React from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { AuthContext, type Me } from "@/lib/auth"
import { api } from "@/lib/api"
import { AuthGate, RequireSuperuser } from "@/components/AuthGate"
import { BaseLayout } from "@/layouts/base-layout"
import { Dashboard } from "@/pages/Dashboard"
import { UsersPage } from "@/pages/admin/Users"
import { AppsPage } from "@/pages/admin/Apps"
import { AccessPage } from "@/pages/admin/Access"
import { TokensPage } from "@/pages/admin/Tokens"

export default function App() {
  const [me, setMe] = React.useState<Me | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const data = await api.get<Me>("/api/me")
      setMe(data)
    } catch {
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <ThemeProvider>
      <AuthContext.Provider value={{ me, loading, refresh }}>
        <BrowserRouter>
          <AuthGate>
            <BaseLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route
                  path="/admin/users"
                  element={<RequireSuperuser><UsersPage /></RequireSuperuser>}
                />
                <Route
                  path="/admin/apps"
                  element={<RequireSuperuser><AppsPage /></RequireSuperuser>}
                />
                <Route
                  path="/admin/access"
                  element={<RequireSuperuser><AccessPage /></RequireSuperuser>}
                />
                <Route
                  path="/admin/tokens"
                  element={<RequireSuperuser><TokensPage /></RequireSuperuser>}
                />
                <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BaseLayout>
          </AuthGate>
        </BrowserRouter>
        <Toaster />
      </AuthContext.Provider>
    </ThemeProvider>
  )
}
