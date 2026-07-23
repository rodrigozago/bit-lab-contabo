import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.ts";
import { api } from "../api/client.ts";
import type { Mention, MonitoringTarget } from "@sentinela/shared";

export function Dashboard() {
  const { me } = useAuth();
  const tenants = me?.tenants ?? [];
  const [tenantId, setTenantId] = useState<string | null>(tenants[0]?.id ?? null);
  const [targets, setTargets] = useState<MonitoringTarget[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    void api.targets.list(tenantId).then(setTargets);
    void api.mentions.list(tenantId).then(setMentions);
  }, [tenantId]);

  if (tenants.length === 0) {
    return (
      <div className="mx-auto max-w-xl p-10 text-center">
        <h1 className="text-xl font-semibold">Nenhum tenant ainda</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Crie um tenant via <code>POST /api/tenants</code> pra começar a monitorar.
        </p>
        {me?.isAdmin && (
          <Link to="/admin/scraping" className="mt-4 inline-block text-sm text-primary hover:underline">
            Ver status do scraping →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">🛰️ Sentinela</h1>
        <div className="flex items-center gap-3">
          {me?.isAdmin && (
            <Link to="/admin/scraping" className="text-sm text-muted-foreground hover:underline">
              Scraping
            </Link>
          )}
          <select
            className="rounded-md border border-border bg-card px-2 py-1 text-sm"
            value={tenantId ?? ""}
            onChange={(e) => setTenantId(e.target.value)}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Alvos monitorados</h2>
        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum candidato/partido/influenciador cadastrado.</p>
        ) : (
          <ul className="space-y-1">
            {targets.map((t) => (
              <li key={t.id} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                <span className="font-medium">{t.nome}</span>{" "}
                <span className="text-muted-foreground">({t.tipo})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Menções recentes</h2>
        {mentions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma menção coletada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {mentions.map((m) => (
              <li key={m.id} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                <p>{m.texto}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.sentimento ?? "sem análise"} {m.url ? `· ${m.url}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
