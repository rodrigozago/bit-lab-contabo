-- schema aplicado no boot (migrate-on-boot) — sem framework de migração por ora,
-- mesmo padrão do ponto-studio/face-lab (ver apps/api/src/db.ts)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plano TEXT NOT NULL DEFAULT 'trial',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- membership do usuário OIDC (identificado por e-mail, não há tabela de users
-- própria — a identidade vem do auth central) num tenant
CREATE TABLE IF NOT EXISTS tenant_users (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_email)
);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(user_email);

CREATE TABLE IF NOT EXISTS monitoring_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('candidato', 'partido', 'influenciador')),
  nome TEXT NOT NULL,
  contas_redes JSONB NOT NULL DEFAULT '{}', -- ex: {"twitter": "@fulano", "instagram": "fulano"}
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_targets_tenant ON monitoring_targets(tenant_id);

CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  termo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_keywords_tenant ON keywords(tenant_id);

-- fontes de coleta — tenant_id nulo = fonte compartilhada entre tenants
-- (ex: um feed de notícias genérico usado por todo mundo)
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('news', 'twitter', 'instagram')),
  url_ou_handle TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sources_tenant ON sources(tenant_id);
-- upsert idempotente ao sincronizar sources a partir de targets/keywords
-- (ver apps/api/src/services/sources.ts) — só se aplica a sources com
-- tenant_id definido; Postgres trata NULL como distinto em índice único,
-- então fontes compartilhadas (tenant_id nulo) não caem aqui de propósito
-- (a rota de admin faz select-then-upsert em vez de contar com o índice).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_unique_por_tenant
  ON sources(tenant_id, tipo, url_ou_handle) WHERE tenant_id IS NOT NULL;

-- staging: conteúdo bruto coletado pelos workers de ingestão, antes de passar
-- pelo worker de análise (sentimento/entidades/embedding)
CREATE TABLE IF NOT EXISTS raw_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  conteudo_bruto JSONB NOT NULL, -- payload cru do scraper, formato varia por tipo de fonte
  hash_dedup TEXT NOT NULL, -- hash do conteúdo, evita reprocessar o mesmo item
  coletado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  processado BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_items_hash ON raw_items(source_id, hash_dedup);
CREATE INDEX IF NOT EXISTS idx_raw_items_pendentes ON raw_items(processado) WHERE processado = false;

CREATE TABLE IF NOT EXISTS mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_id UUID REFERENCES monitoring_targets(id) ON DELETE SET NULL,
  keyword_id UUID REFERENCES keywords(id) ON DELETE SET NULL,
  raw_item_id UUID NOT NULL REFERENCES raw_items(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  url TEXT,
  publicado_em TIMESTAMPTZ,
  sentimento TEXT CHECK (sentimento IN ('positivo', 'negativo', 'neutro')),
  score REAL,
  entidades JSONB NOT NULL DEFAULT '[]',
  embedding vector(1536), -- text-embedding-3-small
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mentions_tenant ON mentions(tenant_id, publicado_em DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_target ON mentions(target_id);
-- busca por similaridade (dedup / semântica) — HNSW é o índice recomendado
-- pelo pgvector pra cosine distance em produção
CREATE INDEX IF NOT EXISTS idx_mentions_embedding ON mentions USING hnsw (embedding vector_cosine_ops);

-- pool de contas X usadas pelo worker de ingestão social (twscrape) — infra
-- da plataforma, não é dado de tenant. auth_token/ct0 são cookies de sessão
-- (equivalem a estar logado naquela conta) e por isso ficam cifrados com
-- AES-256-GCM em nível de aplicação, nunca em texto puro — ver
-- workers/ingest-social/crypto.py e manage_accounts.py.
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('twitter')),
  username TEXT NOT NULL,
  auth_token_encrypted BYTEA NOT NULL,
  ct0_encrypted BYTEA NOT NULL,
  proxy_url TEXT, -- opcional: proxy dedicado pra essa conta; sem isso, usa o Scrapoxy padrão
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- histórico de execuções dos workers de ingestão/análise — alimenta o
-- dashboard de scraping (status por fonte + log de erros). Não é dado de
-- tenant, é observabilidade da própria plataforma.
CREATE TABLE IF NOT EXISTS scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker TEXT NOT NULL CHECK (worker IN ('ingest-news', 'ingest-social', 'analysis')),
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  mensagem TEXT,
  itens INTEGER NOT NULL DEFAULT 0,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_executado ON scrape_runs(executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_status ON scrape_runs(status) WHERE status = 'error';

-- fase 2: regra existe desde já, mas sem worker de envio ainda
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  regra JSONB NOT NULL,
  canal TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
