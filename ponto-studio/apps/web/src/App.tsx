import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./components/Home.tsx";
import { EditorRoute } from "./components/EditorRoute.tsx";
import { api } from "./api/client.ts";
import { AuthContext, useAuth, loginUrl, type Me } from "./lib/auth.ts";
import { ToastProvider } from "./components/Toast.tsx";

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
        <AuthGate />
      </ToastProvider>
    </AuthContext.Provider>
  );
}

function AuthGate() {
  const { me, loading } = useAuth();

  if (loading) {
    return (
      <div style={styles.page}>
        <span style={{ fontSize: 32 }}>🪡</span>
      </div>
    );
  }

  if (!me) {
    const pending = new URLSearchParams(window.location.search).get("authStatus") === "pending";
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>🪡</div>
          <h1 style={styles.title}>Ponto Studio</h1>
          {pending ? (
            <>
              <p style={styles.subtitle}>Conta em análise</p>
              <p style={styles.body}>
                Sua conta foi criada, mas ainda não tem acesso ao Ponto Studio — um admin precisa aprovar sua
                solicitação antes que você possa entrar.
              </p>
            </>
          ) : (
            <>
              <p style={styles.subtitle}>Digitalize seus bordados</p>
              <button style={styles.cta} onClick={() => (window.location.href = loginUrl())}>
                Entrar →
              </button>
            </>
          )}
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f5f0ff 0%, #f5f4f0 100%)",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "40px 48px",
    width: 420,
    boxShadow: "0 8px 32px rgba(124,92,191,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    textAlign: "center",
  },
  logo: { fontSize: 40 },
  title: { fontSize: 28, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  subtitle: { fontSize: 14, color: "#7c5cbf", margin: 0, fontWeight: 600 },
  body: { fontSize: 14, color: "#6b6b6b", lineHeight: 1.5, margin: 0 },
  cta: {
    background: "#7c5cbf",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    marginTop: 8,
    cursor: "pointer",
    transition: "background 0.15s",
  },
};
