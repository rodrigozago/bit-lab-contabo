import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.ts";
import { api } from "../api/client.ts";
import type { Keyword, Mention, MonitoringTarget, TargetType } from "@sentinela/shared";

export function Dashboard() {
  const { me, refresh } = useAuth();
  const tenants = me?.tenants ?? [];
  const [tenantId, setTenantId] = useState<string | null>(tenants[0]?.id ?? null);

  useEffect(() => {
    // se o tenant selecionado sumiu (ex: acabou de criar o 1º) ou nenhum
    // estava selecionado ainda, cai pro primeiro da lista
    if (!tenantId && tenants.length > 0) setTenantId(tenants[0].id);
  }, [tenants, tenantId]);

  if (tenants.length === 0) {
    return (
      <div className="mx-auto max-w-sm p-10">
        <div className="text-center">
          <h1 className="text-xl font-bold">🛰️ Sentinela</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie seu workspace pra começar a monitorar candidatos, partidos e palavras-chave.
          </p>
        </div>
        <CreateTenantForm onCreated={() => void refresh()} />
        {me?.isAdmin && (
          <Link
            to="/admin/scraping"
            className="mt-4 block text-center text-sm text-muted-foreground hover:underline"
          >
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

      {tenantId && <TenantWorkspace tenantId={tenantId} />}
    </div>
  );
}

function CreateTenantForm({ onCreated }: { onCreated: () => void }) {
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.tenants.create(nome.trim());
      setNome("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro ao criar workspace");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-2">
      <input
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        placeholder="Nome do workspace (ex: Campanha João Silva 2026)"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={loading || !nome.trim()}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Criando..." : "Criar workspace"}
      </button>
    </form>
  );
}

function TenantWorkspace({ tenantId }: { tenantId: string }) {
  const [targets, setTargets] = useState<MonitoringTarget[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);

  const reloadTargets = () => void api.targets.list(tenantId).then(setTargets);
  const reloadKeywords = () => void api.keywords.list(tenantId).then(setKeywords);

  useEffect(() => {
    reloadTargets();
    reloadKeywords();
    void api.mentions.list(tenantId).then(setMentions);
  }, [tenantId]);

  return (
    <>
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Alvos monitorados</h2>
        <TargetForm tenantId={tenantId} onCreated={reloadTargets} />
        {targets.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum candidato/partido/influenciador cadastrado.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {targets.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{t.nome}</span>{" "}
                  <span className="text-muted-foreground">
                    ({t.tipo}
                    {t.contasRedes.twitter ? ` · X: ${t.contasRedes.twitter}` : ""})
                  </span>
                </span>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={async () => {
                    await api.targets.update(tenantId, t.id, { ativo: !t.ativo });
                    reloadTargets();
                  }}
                >
                  {t.ativo ? "desativar" : "ativar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Palavras-chave</h2>
        <KeywordForm tenantId={tenantId} onCreated={reloadKeywords} />
        {keywords.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma palavra-chave cadastrada.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {keywords.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <span>{k.termo}</span>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={async () => {
                    await api.keywords.update(tenantId, k.id, !k.ativo);
                    reloadKeywords();
                  }}
                >
                  {k.ativo ? "desativar" : "ativar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Menções recentes</h2>
        {mentions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma menção coletada ainda — pode levar alguns minutos depois de cadastrar um alvo/palavra-chave.
          </p>
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
    </>
  );
}

const TARGET_TYPES: { value: TargetType; label: string }[] = [
  { value: "candidato", label: "Candidato" },
  { value: "partido", label: "Partido" },
  { value: "influenciador", label: "Influenciador" },
];

function TargetForm({ tenantId, onCreated }: { tenantId: string; onCreated: () => void }) {
  const [tipo, setTipo] = useState<TargetType>("candidato");
  const [nome, setNome] = useState("");
  const [twitter, setTwitter] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setLoading(true);
    try {
      await api.targets.create(tenantId, tipo, nome.trim(), twitter.trim() ? { twitter: twitter.trim() } : undefined);
      setNome("");
      setTwitter("");
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
      <select
        className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        value={tipo}
        onChange={(e) => setTipo(e.target.value as TargetType)}
      >
        {TARGET_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        className="min-w-[160px] flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
        placeholder="Nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <input
        className="w-40 rounded-md border border-border bg-card px-3 py-2 text-sm"
        placeholder="@handle no X (opcional)"
        value={twitter}
        onChange={(e) => setTwitter(e.target.value)}
      />
      <button
        type="submit"
        disabled={loading || !nome.trim()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Adicionar
      </button>
    </form>
  );
}

function KeywordForm({ tenantId, onCreated }: { tenantId: string; onCreated: () => void }) {
  const [termo, setTermo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!termo.trim()) return;
    setLoading(true);
    try {
      await api.keywords.create(tenantId, termo.trim());
      setTermo("");
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
        placeholder="Palavra-chave ou assunto (ex: reforma tributária)"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
      />
      <button
        type="submit"
        disabled={loading || !termo.trim()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Adicionar
      </button>
    </form>
  );
}
