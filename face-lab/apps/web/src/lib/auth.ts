import { createContext, useContext } from "react";
import type { Me } from "@face-lab/shared";

export interface AuthState {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({ me: null, loading: true, refresh: async () => {} });
export const useAuth = () => useContext(AuthContext);

export function loginUrl(returnTo?: string): string {
  const rt = returnTo ?? window.location.pathname;
  return `/api/auth/login?returnTo=${encodeURIComponent(rt)}`;
}
