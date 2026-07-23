import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client.ts";
import { BaseLayout } from "../layouts/base-layout.tsx";
import type { NewsSource } from "@sentinela/shared";

export function AdminNewsSources() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setSources(await api.admin.newsSources());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(src: NewsSource) {
    await api.admin.setNewsSourceActive(src.id, !src.ativo);
    void load();
  }

  return (
    <BaseLayout
      title="Fontes de notícia"
      description="Feeds RSS compartilhados — cada notícia coletada aqui é comparada contra os alvos/palavras-chave de todos os tenants (não é preciso cadastrar um feed por cliente)."
    >
      <div className="px-4 lg:px-6">
        <NewsSourceForm onCreated={load} />

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2">URL do feed</th>
                  <th className="px-3 py-2">Cadastrado em</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((n) => (
                  <tr key={n.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{n.urlOuHandle}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(n.criadoEm).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">{n.ativo ? "ativo" : "desativado"}</td>
                    <td className="px-3 py-2">
                      <button className="text-xs text-primary hover:underline" onClick={() => void toggle(n)}>
                        {n.ativo ? "desativar" : "ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
                {sources.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                      Nenhum feed cadastrado ainda.
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

function NewsSourceForm({ onCreated }: { onCreated: () => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      await api.admin.createNewsSource(url.trim());
      setUrl("");
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
        placeholder="URL do feed RSS (ex: https://veiculo.com/rss)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Adicionar
      </button>
    </form>
  );
}
