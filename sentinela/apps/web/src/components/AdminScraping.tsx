import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.ts";
import type { ScrapeRun, SourceStatus, SocialAccountSummary } from "@sentinela/shared";

const statusColor: Record<string, string> = {
  ok: "text-green-600 dark:text-green-400",
  error: "text-destructive",
};

export function AdminScraping() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [accounts, setAccounts] = useState<SocialAccountSummary[]>([]);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [s, r, a] = await Promise.all([
      api.admin.sources(),
      api.admin.scrapeRuns(onlyErrors ? { status: "error" } : undefined),
      api.admin.socialAccounts(),
    ]);
    setSources(s);
    setRuns(r);
    setAccounts(a);
    setLoading(false);
  }, [onlyErrors]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 15_000);
    return () => clearInterval(interval);
  }, [load]);

  async function toggleAccount(acc: SocialAccountSummary) {
    await api.admin.setSocialAccountActive(acc.id, !acc.ativo);
    void load();
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">🛰️ Scraping — status e logs</h1>
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← voltar ao dashboard
        </Link>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Fontes</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">URL / handle</th>
                <th className="px-3 py-2">Ativa</th>
                <th className="px-3 py-2">Última execução</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2">{s.tipo}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.urlOuHandle}</td>
                  <td className="px-3 py-2">{s.ativo ? "sim" : "não"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.ultimaExecucao ? new Date(s.ultimaExecucao).toLocaleString("pt-BR") : "nunca"}
                  </td>
                  <td className={`px-3 py-2 font-medium ${statusColor[s.ultimoStatus ?? ""] ?? ""}`}>
                    {s.ultimoStatus ?? "—"}
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                    Nenhuma fonte cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Contas X do pool (twscrape)
        </h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Proxy</th>
                <th className="px-3 py-2">Cadastrada em</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-3 py-2">@{a.username}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {a.proxyUrl ?? "padrão (Scrapoxy)"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(a.criadoEm).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2">{a.ativo ? "ativa" : "desativada"}</td>
                  <td className="px-3 py-2">
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => void toggleAccount(a)}
                    >
                      {a.ativo ? "desativar" : "ativar"}
                    </button>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                    Nenhuma conta cadastrada — use{" "}
                    <code>docker compose exec worker-ingest-social python manage_accounts.py add</code>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Log de execuções</h2>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
            só erros
          </label>
        </div>
        <ul className="space-y-1">
          {runs.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <span className={`shrink-0 font-mono text-xs ${statusColor[r.status]}`}>{r.status}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="font-medium">{r.worker}</span>
                  {r.sourceLabel ? ` · ${r.sourceLabel}` : ""}
                  {r.itens > 0 ? ` · ${r.itens} itens` : ""}
                </p>
                {r.mensagem && <p className="truncate text-xs text-muted-foreground">{r.mensagem}</p>}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(r.executadoEm).toLocaleTimeString("pt-BR")}
              </span>
            </li>
          ))}
          {runs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>}
        </ul>
      </section>
    </div>
  );
}
