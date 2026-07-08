import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import type { Me } from "@face-lab/shared";
import { api, ApiError } from "./api";
import { AuthContext, loginUrl, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";
import { AppLayout } from "./components/AppLayout";
import { Landing } from "./pages/Landing";
import { Enroll } from "./pages/Enroll";
import { MyGallery } from "./pages/MyGallery";
import { MyAlbum } from "./pages/MyAlbum";
import { Producer } from "./pages/Producer";
import { ProducerAlbum } from "./pages/ProducerAlbum";
import { Admin } from "./pages/Admin";
import { DebugGallery } from "./pages/__DebugGallery"; // TEMP — remover

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
  const isProducer = me.role === "producer" || me.role === "admin";
  if (admin && me.role !== "admin") return <Navigate to="/" replace />;
  if (producer && !isProducer) return <Navigate to="/" replace />;
  return children;
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
      <Toaster richColors position="bottom-right" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/__debug-gallery" element={<div className="p-10"><DebugGallery /></div>} /> {/* TEMP — remover */}

        <Route element={<AppLayout />}>
          <Route path="/enroll" element={<RequireAuth><Enroll /></RequireAuth>} />
          <Route path="/me" element={<RequireAuth><MyGallery /></RequireAuth>} />
          <Route path="/me/albums/:id" element={<RequireAuth><MyAlbum /></RequireAuth>} />
          <Route path="/producer" element={<RequireAuth producer><Producer /></RequireAuth>} />
          <Route path="/producer/albums/:id" element={<RequireAuth producer><ProducerAlbum /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
