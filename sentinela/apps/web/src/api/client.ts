import type { Me, MonitoringTarget, Keyword, Mention, ScrapeRun, SourceStatus, SocialAccountSummary } from "@sentinela/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error ?? `erro ${res.status}`);
  return body.data as T;
}

export const api = {
  auth: {
    me: () => request<Me>("/api/me"),
  },
  tenants: {
    list: () => request<Me["tenants"]>("/api/tenants"),
    create: (nome: string, slug: string) =>
      request("/api/tenants", { method: "POST", body: JSON.stringify({ nome, slug }) }),
  },
  targets: {
    list: (tenantId: string) => request<MonitoringTarget[]>(`/api/tenants/${tenantId}/targets`),
    create: (tenantId: string, tipo: string, nome: string) =>
      request(`/api/tenants/${tenantId}/targets`, { method: "POST", body: JSON.stringify({ tipo, nome }) }),
  },
  keywords: {
    list: (tenantId: string) => request<Keyword[]>(`/api/tenants/${tenantId}/keywords`),
    create: (tenantId: string, termo: string) =>
      request(`/api/tenants/${tenantId}/keywords`, { method: "POST", body: JSON.stringify({ termo }) }),
  },
  mentions: {
    list: (tenantId: string) => request<Mention[]>(`/api/tenants/${tenantId}/mentions`),
  },
  admin: {
    scrapeRuns: (opts?: { worker?: string; status?: string }) => {
      const params = new URLSearchParams(opts as Record<string, string>);
      const qs = params.toString();
      return request<ScrapeRun[]>(`/api/admin/scrape-runs${qs ? `?${qs}` : ""}`);
    },
    sources: () => request<SourceStatus[]>("/api/admin/sources"),
    socialAccounts: () => request<SocialAccountSummary[]>("/api/admin/social-accounts"),
    setSocialAccountActive: (id: string, ativo: boolean) =>
      request<SocialAccountSummary>(`/api/admin/social-accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ativo }),
      }),
  },
};
