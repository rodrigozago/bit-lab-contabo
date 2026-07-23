import type {
  Me,
  MonitoringTarget,
  Keyword,
  Mention,
  ScrapeRun,
  SourceStatus,
  SocialAccountSummary,
  NewsSource,
  Tenant,
} from "@sentinela/shared";

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
    create: (nome: string) => request<Tenant>("/api/tenants", { method: "POST", body: JSON.stringify({ nome }) }),
  },
  targets: {
    list: (tenantId: string) => request<MonitoringTarget[]>(`/api/tenants/${tenantId}/targets`),
    create: (tenantId: string, tipo: string, nome: string, contasRedes?: Record<string, string>) =>
      request<MonitoringTarget>(`/api/tenants/${tenantId}/targets`, {
        method: "POST",
        body: JSON.stringify({ tipo, nome, contasRedes }),
      }),
    update: (tenantId: string, id: string, patch: { ativo?: boolean; contasRedes?: Record<string, string> }) =>
      request<MonitoringTarget>(`/api/tenants/${tenantId}/targets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
  },
  keywords: {
    list: (tenantId: string) => request<Keyword[]>(`/api/tenants/${tenantId}/keywords`),
    create: (tenantId: string, termo: string) =>
      request<Keyword>(`/api/tenants/${tenantId}/keywords`, { method: "POST", body: JSON.stringify({ termo }) }),
    update: (tenantId: string, id: string, ativo: boolean) =>
      request<Keyword>(`/api/tenants/${tenantId}/keywords/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ativo }),
      }),
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
    newsSources: () => request<NewsSource[]>("/api/admin/news-sources"),
    createNewsSource: (url: string) =>
      request<NewsSource>("/api/admin/news-sources", { method: "POST", body: JSON.stringify({ url }) }),
    setNewsSourceActive: (id: string, ativo: boolean) =>
      request<NewsSource>(`/api/admin/news-sources/${id}`, { method: "PATCH", body: JSON.stringify({ ativo }) }),
  },
};
