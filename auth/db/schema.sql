-- bit-lab auth — schema mínimo: usuários, apps (recursos protegidos) e quem acessa o quê.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Renomeia is_admin -> is_superuser (papel global, distinto do "admin de app"
-- introduzido em app_access.role). RENAME COLUMN não é idempotente feito o
-- ADD COLUMN IF NOT EXISTS acima, então guarda por information_schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE users RENAME COLUMN is_admin TO is_superuser;
  END IF;
END $$;

-- Perfil self-service (nome, foto) — avatar nunca é obrigatório. avatar_path
-- guarda o caminho relativo dentro de MEDIA_DIR (ex.
-- "avatars/<id>-<timestamp>.jpg"), nunca a URL completa — monta a URL
-- pública em src/media.js (avatarUrl()), não aqui.
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path TEXT;

-- instagram/whatsapp — obrigatórios no signup (routes/auth.js POST /signup),
-- mas a coluna em si não tem NOT NULL: contas criadas antes dessa mudança
-- (admin.js POST /api/users, ou signups antigos) ficam com null até
-- completarem o perfil em apps.bit-lab.tech/profile. Sem CHECK de formato
-- de propósito — mesmo espírito minimalista do resto do schema (ver
-- email_verified sempre true em oidc.js).
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Verificação de e-mail real (ver email/, mailClient.js, routes/auth.js
-- GET/POST /verify-email). Default TRUE de propósito: contas já existentes e
-- contas criadas pelo admin (POST /admin/api/users) NUNCA foram verificadas
-- por link e não devem ser bloqueadas retroativamente. Só o self-signup
-- (POST /signup sem token de convite) cria o usuário com FALSE explícito.
-- Convite não passa por aqui de novo: o token só chega no e-mail certo, já
-- prova posse (ver decisão em SEGURANCA-PRE-LANCAMENTO.md item 10).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Esqueci minha senha" — não existia antes (reset sempre foi manual, feito
-- pelo superuser no painel). Mesmo padrão hash-only de signup_tokens: só o
-- hash fica no banco, o valor bruto só existe na URL enviada por e-mail.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Self-signup deixou de ser uma flag global (ALLOW_SELF_SIGNUP/
-- SELF_SIGNUP_GRANT_APPS) — agora é por app, controlado pelo superuser no painel.
ALTER TABLE apps ADD COLUMN IF NOT EXISTS allow_self_signup BOOLEAN NOT NULL DEFAULT false;

-- Termo de uso PRÓPRIO do app (além do termo global aceito no cadastro,
-- ver legal_acceptances). NULL = app não exige termo próprio (comportamento
-- padrão). Setar os dois pra pedir aceite específico no primeiro acesso
-- daquele app (ver routes/interaction.js, prompt "consent").
ALTER TABLE apps ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS terms_url TEXT;

-- Aceite de termos/privacidade — scope='global' é o aceite único do
-- cadastro (obrigatório pra todo mundo); scope=<slug do app> é o aceite do
-- termo próprio daquele app (só quando apps.terms_version não é nulo).
-- Versão faz parte da chave: subir a versão invalida aceites antigos sem
-- precisar apagar histórico (fica registrado quem aceitou qual versão).
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, version)
);

-- Nome "app_access" (não "grants") para não colidir conceitualmente com o
-- modelo interno "Grant" do oidc-provider — são coisas diferentes: isto é
-- a permissão de negócio (usuário X pode acessar app Y).
CREATE TABLE IF NOT EXISTS app_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);

-- Papel do usuário DENTRO daquele app específico: 'app_admin' é o "Admin (de
-- app)" — role elevado só naquele app, sem mexer no is_superuser global nem
-- no papel do mesmo usuário em outros apps. Default 'end_user' preserva o
-- significado das linhas já existentes (não havia conceito de app-admin antes).
ALTER TABLE app_access ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'end_user'
  CHECK (role IN ('end_user', 'app_admin'));

-- Links de convite gerados pelo superuser (substituem o self-signup global E
-- a antiga fila de solicitação de acesso — removida: acesso só sai de convite
-- ou self-signup ligado pro app específico, nada mais fica pendente):
-- token_hash guarda só o sha256 do token — o valor bruto só existe na URL
-- entregue ao convidado no momento da criação, nunca fica no banco.
CREATE TABLE IF NOT EXISTS signup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('end_user', 'app_admin')),
  email TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quais apps o link concede (com o `role` do token) quando resgatado.
CREATE TABLE IF NOT EXISTS signup_token_apps (
  token_id UUID NOT NULL REFERENCES signup_tokens(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  PRIMARY KEY (token_id, app_id)
);

-- Trilha de auditoria das ações de admin (criar/deletar usuário, resetar
-- senha, conceder/revogar acesso). Sem isto não há como investigar uma conta
-- comprometida ou acesso indevido. Ver
-- ponto-studio/docs/SEGURANCA-PRE-LANCAMENTO.md item 11. actor_id não é FK
-- (ON DELETE) de propósito: o log tem que sobreviver à remoção do ator.
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  target TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_at ON audit_log (created_at DESC);
