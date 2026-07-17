import { createContext, useContext, useMemo } from "react";
import { toast as sonnerToast } from "sonner";

/**
 * Mini sistema de toast (EDIT-6) — substitui alert() cru e erros silenciosos.
 * Uso: const toast = useToast(); toast.error("mensagem");
 *
 * Por baixo usa o sonner (shadcn) — a API do hook (error/info) não muda,
 * então nenhum call site precisa ser tocado.
 */

interface ToastApi {
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi>({
  error: (m) => sonnerToast.error(m),
  info: (m) => sonnerToast(m),
});

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const api: ToastApi = useMemo(
    () => ({
      error: (m) => sonnerToast.error(m),
      info: (m) => sonnerToast(m),
    }),
    []
  );

  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
}
