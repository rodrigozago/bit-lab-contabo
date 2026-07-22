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

CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Self-signup deixou de ser uma flag global (ALLOW_SELF_SIGNUP/
-- SELF_SIGNUP_GRANT_APPS) — agora é por app, controlado pelo superuser no painel.
ALTER TABLE apps ADD COLUMN IF NOT EXISTS allow_self_signup BOOLEAN NOT NULL DEFAULT false;

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

-- Fila de solicitações de acesso: quem tenta logar num app sem app_access
-- fica pendente até um superuser aprovar (ou recusar) pelo painel — aprovação
-- sempre concede papel 'end_user' (app_admin só sai de convite explícito).
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES users(id)
);

-- Só 1 solicitação PENDENTE por usuário+app (histórico de aprovadas/recusadas
-- pode acumular à vontade, só a pendente precisa ser única).
CREATE UNIQUE INDEX IF NOT EXISTS access_requests_pending_unique
  ON access_requests (user_id, app_id) WHERE status = 'pending';

-- Links de convite gerados pelo superuser (substituem o self-signup global):
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
