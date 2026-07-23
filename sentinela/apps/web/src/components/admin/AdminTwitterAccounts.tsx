import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client.ts";
import { BaseLayout } from "../layouts/base-layout.tsx";
import type { SocialAccountSummary } from "@sentinela/shared";

export function AdminTwitterAccounts() {
  const [accounts, setAccounts] = useState<SocialAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setAccounts(await api.admin.socialAccounts());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleAccount(acc: SocialAccountSummary) {
    await api.admin.setSocialAccountActive(acc.id, !acc.ativo);
    void load();
  }

  return (
    <BaseLayout
      title="Contas X"
      description="Pool de contas dedicadas usado pelo worker de ingestão social (twscrape) — a X exige login pra busca/timeline."
    >
      <div className="px-4 lg:px-6">
        <AddAccountForm onCreated={load} />

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-md border border-border">
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
                      <button className="text-xs text-primary hover:underline" onClick={() => void toggleAccount(a)}>
                        {a.ativo ? "desativar" : "ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                      Nenhuma conta cadastrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BaseLayout>
  );
}

function AddAccountForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [ct0, setCt0] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !authToken.trim() || !ct0.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.admin.createSocialAccount({
        username: username.trim(),
        authToken: authToken.trim(),
        ct0: ct0.trim(),
        proxyUrl: proxyUrl.trim() || undefined,
      });
      setUsername("");
      setAuthToken("");
      setCt0("");
      setProxyUrl("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro ao cadastrar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Use uma conta X <strong>dedicada</strong> pra isso (nunca uma pessoal). Logue nela num navegador comum →
        DevTools → Application → Cookies → copie os valores de <code>auth_token</code> e <code>ct0</code>. Os
        cookies são cifrados (AES-256-GCM) antes de ir pro banco.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="usuário (sem @)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="auth_token"
          value={authToken}
          onChange={(e) => setAuthToken(e.target.value)}
        />
        <input
          className="min-w-[160px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="ct0"
          value={ct0}
          onChange={(e) => setCt0(e.target.value)}
        />
        <input
          className="w-48 rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="proxy dedicado (opcional)"
          value={proxyUrl}
          onChange={(e) => setProxyUrl(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !username.trim() || !authToken.trim() || !ct0.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Cadastrando..." : "Cadastrar conta"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
