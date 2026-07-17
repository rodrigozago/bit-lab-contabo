import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./components/Home.tsx";
import { EditorRoute } from "./components/EditorRoute.tsx";
import { api } from "./api/client.ts";
import { AuthContext, useAuth, loginUrl, type Me } from "./lib/auth.ts";
import { ToastProvider } from "./components/Toast.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";

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
    <AuthContext.Provider value={{ me, loading: authLoading, refresh }}>
      <ToastProvider>
        <Toaster />
        <AuthGate />
      </ToastProvider>
    </AuthContext.Provider>
  );
}

function AuthGate() {
  const { me, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted">
        <span className="text-4xl">🪡</span>
      </div>
    );
  }

  if (!me) {
    const pending = new URLSearchParams(window.location.search).get("authStatus") === "pending";
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
        <div className="w-full max-w-sm md:max-w-3xl">
          <Card className="overflow-hidden">
            <CardContent className="grid p-0 md:grid-cols-2">
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center md:p-10">
                <span className="text-4xl">🪡</span>
                <h1 className="text-2xl font-bold">Ponto Studio</h1>
                {pending ? (
                  <>
                    <p className="text-sm font-semibold text-primary">Conta em análise</p>
                    <p className="text-sm text-muted-foreground">
                      Sua conta foi criada, mas ainda não tem acesso ao Ponto Studio — um admin precisa
                      aprovar sua solicitação antes que você possa entrar.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-primary">Digitalize seus bordados</p>
                    <Button size="lg" className="mt-2 w-full" onClick={() => (window.location.href = loginUrl())}>
                      Entrar →
                    </Button>
                  </>
                )}
              </div>
              <div
                className="relative hidden md:flex md:items-center md:justify-center"
                style={{ background: "linear-gradient(135deg, #f5f0ff 0%, #f5f4f0 100%)" }}
              >
                <span className="text-8xl opacity-80">🪡</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects/:id" element={<EditorRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
