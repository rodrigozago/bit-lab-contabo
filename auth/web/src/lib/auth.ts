import { createContext, useContext } from "react";

export interface Me {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isSuperuser: boolean;
}

export interface AuthState {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({ me: null, loading: true, refresh: async () => {} });
export const useAuth = () => useContext(AuthContext);

// Login/logout continuam nas telas vanilla existentes, servidas pelo backend
// (auth.bit-lab.tech em produção — em dev, o proxy do vite já resolve o path
// relativo). São NAVEGAÇÕES de página inteira, não fetch() — cross-origin sem
// CORS, e o cookie bl_session (Domain=.bit-lab.tech) já é compartilhado.
const AUTH_ORIGIN = import.meta.env.DEV ? "" : "https://auth.bit-lab.tech";

export function loginUrl(returnTo?: string): string {
  const rt = returnTo ?? window.location.href;
  return `${AUTH_ORIGIN}/login?redirect=${encodeURIComponent(rt)}`;
}

export function logoutUrl(returnTo?: string): string {
  const rt = returnTo ?? window.location.origin + "/";
  return `${AUTH_ORIGIN}/logout?redirect=${encodeURIComponent(rt)}`;
}
