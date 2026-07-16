-- ponto-studio — schema (idempotente: a API roda este arquivo em todo boot)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  -- sub (OIDC) do usuário dono do projeto — formato não garantido, não é UUID
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  canvas_width_mm REAL NOT NULL,
  canvas_height_mm REAL NOT NULL,
  elements JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects (owner_id);
