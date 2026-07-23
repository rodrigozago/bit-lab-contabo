import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { api } from "./api/client.ts";
import { AuthContext, useAuth, loginUrl } from "./lib/auth.ts";
import type { Me } from "@sentinela/shared";
import { Dashboard } from "./components/Dashboard.tsx";
import { AdminTwitterAccounts } from "./components/admin/AdminTwitterAccounts.tsx";
import { AdminNewsSources } from "./components/admin/AdminNewsSources.tsx";
import { AdminScrapeLogs } from "./components/admin/AdminScrapeLogs.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.auth.me());
    } catch {
      setMe(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="sentinela-ui-theme">
      <AuthContext.Provider value={{ me, loading: authLoading, refresh }}>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <AuthGate>
                  <Dashboard />
                </AuthGate>
              }
            />
            <Route
              path="/admin/twitter-accounts"
              element={
                <AuthGate>
                  <RequireAdmin>
                    <AdminTwitterAccounts />
                  </RequireAdmin>
                </AuthGate>
              }
            />
            <Route
              path="/admin/news-sources"
              element={
                <AuthGate>
                  <RequireAdmin>
                    <AdminNewsSources />
                  </RequireAdmin>
                </AuthGate>
              }
            />
            <Route
              path="/admin/scrape-logs"
              element={
                <AuthGate>
                  <RequireAdmin>
                    <AdminScrapeLogs />
                  </RequireAdmin>
                </AuthGate>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted">
        <span className="text-4xl">🛰️</span>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-10 text-center shadow-sm">
          <span className="text-4xl">🛰️</span>
          <h1 className="mt-4 text-2xl font-bold text-card-foreground">Sentinela</h1>
          <p className="mt-2 text-sm text-muted-foreground">Monitoramento político em tempo real</p>
          <button
            className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            onClick={() => (window.location.href = loginUrl())}
          >
            Entrar →
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { me } = useAuth();
  if (!me?.isAdmin) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Acesso restrito a admins.</div>;
  }
  return <>{children}</>;
}
