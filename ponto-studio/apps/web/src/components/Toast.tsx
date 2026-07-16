import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/**
 * Mini sistema de toast (EDIT-6) — substitui alert() cru e erros silenciosos.
 * Uso: const toast = useToast(); toast.error("mensagem");
 */

interface ToastItem {
  id: number;
  kind: "error" | "info";
  message: string;
}

interface ToastApi {
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi>({
  // fallback: nunca deve acontecer com o provider registrado no App, mas
  // não pode quebrar quem chama
  error: (m) => console.error(m),
  info: (m) => console.info(m),
});

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastItem["kind"], message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const api: ToastApi = useMemo(
    () => ({
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 && (
        <div style={styles.container}>
          {toasts.map((t) => (
            <div key={t.id} style={{ ...styles.toast, ...(t.kind === "error" ? styles.error : styles.info) }}>
              <span style={styles.message}>
                {t.kind === "error" ? "⚠ " : ""}
                {t.message}
              </span>
              <button
                style={styles.close}
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    zIndex: 3000,
    maxWidth: "min(560px, 92vw)",
  },
  toast: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
    fontSize: 13,
    lineHeight: 1.4,
  },
  error: { background: "#fff0f0", border: "1.5px solid #e8a0a0", color: "#b03030" },
  info: { background: "#f5f0ff", border: "1.5px solid #c9c2e8", color: "#5a4590" },
  message: { flex: 1, wordBreak: "break-word" },
  close: {
    border: "none",
    background: "transparent",
    fontSize: 16,
    cursor: "pointer",
    color: "inherit",
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
};
