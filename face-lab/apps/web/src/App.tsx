import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useRollbar } from "@rollbar/react";
import type { Me } from "@face-lab/shared";
import { api, ApiError } from "./api";
import { AuthContext, loginUrl, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";
import { AppLayout } from "./components/AppLayout";
import { Landing } from "./pages/Landing";
import { Enroll } from "./pages/Enroll";
import { MyGallery } from "./pages/MyGallery";
import { MyAlbum } from "./pages/MyAlbum";
import { MyAlbumAll } from "./pages/MyAlbumAll";
import { Producer } from "./pages/Producer";
import { ProducerAlbum } from "./pages/ProducerAlbum";
import { Admin } from "./pages/Admin";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";
import { AcceptTerms } from "./pages/AcceptTerms";
import Resources from "./pages/Resources";
import { PublicPortfolio } from "./pages/PublicPortfolio";
import { PublicAlbum } from "./pages/PublicAlbum";
import { ProducerPage } from "./pages/ProducerPage";

// compat: páginas antigas importam de "../App"
export { useAuth, loginUrl } from "@/lib/auth";

function RequireAuth({ children, producer, admin }: { children: JSX.Element; producer?: boolean; admin?: boolean }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!me) {
    window.location.href = loginUrl(location.pathname);
    return null;
  }
  // gate obrigatório: sem aceite dos Termos/Privacidade, nada mais é acessível
  if (me.needsTermsAcceptance && location.pathname !== "/consent") {
    return <Navigate to="/consent" replace />;
  }
  const isProducer = me.role === "producer" || me.role === "admin";
  if (admin && me.role !== "admin") return <Navigate to="/" replace />;
  if (producer && !isProducer) return <Navigate to="/" replace />;
  return children;
}

// liga erros/logs do Rollbar ao usuário logado (person tracking)
function RollbarPerson({ me }: { me: Me | null }) {
  const rollbar = useRollbar();
  useEffect(() => {
    if (me) {
      rollbar.configure({ payload: { person: { id: me.id, email: me.email } } });
    }
  }, [me, rollbar]);
  return null;
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setMe(null);
      else console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ me, loading, refresh }}>
      <RollbarPerson me={me} />
      <Toaster richColors position="bottom-right" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/resources" element={<Resources />} />
        {/* portfólio público do fotógrafo — sem auth e sem chrome do app */}
        <Route path="/p/:slug" element={<PublicPortfolio />} />
        <Route path="/p/:slug/:albumId" element={<PublicAlbum />} />
        <Route path="/consent" element={<RequireAuth><AcceptTerms /></RequireAuth>} />

        <Route element={<AppLayout />}>
          <Route path="/enroll" element={<RequireAuth><Enroll /></RequireAuth>} />
          <Route path="/me" element={<RequireAuth><MyGallery /></RequireAuth>} />
          <Route path="/me/albums/:id" element={<RequireAuth><MyAlbum /></RequireAuth>} />
          <Route path="/me/albums/:id/all" element={<RequireAuth><MyAlbumAll /></RequireAuth>} />
          <Route path="/producer" element={<RequireAuth producer><Producer /></RequireAuth>} />
          <Route path="/producer/page" element={<RequireAuth producer><ProducerPage /></RequireAuth>} />
          <Route path="/producer/albums/:id" element={<RequireAuth producer><ProducerAlbum /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
