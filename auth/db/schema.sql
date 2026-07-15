-- bit-lab auth — schema mínimo: usuários, apps (recursos protegidos) e quem acessa o quê.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- Fila de solicitações de acesso: signup não concede app_access
-- automaticamente pra apps fora de SELF_SIGNUP_GRANT_APPS — o usuário fica
-- pendente até um admin aprovar (ou recusar) pelo painel.
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
