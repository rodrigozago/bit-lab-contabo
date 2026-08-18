import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { LandingPage } from "./components/landing/index.tsx";
import { FeedbackButton } from "./components/FeedbackButton.tsx";
import { api } from "./api/client.ts";
import { AuthContext, useAuth, loginUrl, type Me } from "./lib/auth.ts";
import { ToastProvider } from "./components/Toast.tsx";
import { ThemeProvider } from "@/components/theme-provider";
import { Logo } from "@/components/logo.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";

// lazy: Home/EditorRoute (via Editor.tsx) puxam @tldraw/tldraw, que não roda
// em Node — scripts/prerender.tsx importa este App.tsx inteiro (pra bater
// exatamente com a árvore de componentes do client e o useId() do Radix não
// dessincronizar na hidratação, ver comentário lá) mas só a rota "/" é
// renderizada nesse passo, então o import() de dentro do lazy() nunca chega
// a rodar — sem isso, o `import` estático no topo do arquivo já teria
// carregado o tldraw e quebrado o build.
const Home = lazy(() => import("./components/Home.tsx").then((m) => ({ default: m.Home })));
const EditorRoute = lazy(() => import("./components/EditorRoute.tsx").then((m) => ({ default: m.EditorRoute })));

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
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthContext.Provider value={{ me, loading: authLoading, refresh }}>
        <ToastProvider>
          <Toaster />
          {/* Router (BrowserRouter no client, StaticRouter no
              scripts/prerender.tsx) fica por conta de quem monta o App —
              main.tsx e o prerender precisam do mesmo Router "por fora"
              pra não afetar a árvore de componentes daqui pra dentro. */}
          <Suspense
            fallback={
              <div className="flex min-h-svh items-center justify-center bg-muted">
                <Logo size={40} variant="transparent" />
              </div>
            }
          >
            <Routes>
              {/* Landing pública na raiz — sem gate de auth */}
              <Route path="/" element={<LandingPage />} />
              {/* App autenticado vive em /app */}
              <Route
                path="/app"
                element={
                  <AuthGate>
                    <Home />
                  </AuthGate>
                }
              />
              <Route
                path="/app/projects/:id"
                element={
                  <AuthGate>
                    <EditorRoute />
                  </AuthGate>
                }
              />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted">
        <Logo size={40} variant="transparent" />
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
                <Logo size={40} variant="transparent" />
                <h1 className="text-2xl font-bold">Bordado Digital</h1>
                {pending ? (
                  <>
                    <p className="text-sm font-semibold text-primary">Conta em análise</p>
                    <p className="text-sm text-muted-foreground">
                      Sua conta foi criada, mas ainda não tem acesso ao Bordado Digital — um admin precisa
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
              <div className="relative hidden bg-muted md:flex md:items-center md:justify-center">
                <Logo size={140} variant="transparent" className="opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <FeedbackButton />
    </>
  );
}
