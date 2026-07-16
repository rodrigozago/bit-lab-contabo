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

-- Bastidores customizados por usuário (os padrões são hardcoded no shared)
CREATE TABLE IF NOT EXISTS hoops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  width_mm REAL NOT NULL,
  height_mm REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hoops_owner_idx ON hoops (owner_id);

-- Histórico de versões do projeto (DATA-4) — snapshot do estado que foi
-- substituído, com coalescing de 10min no update (autosave não vira spam)
CREATE TABLE IF NOT EXISTS project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  canvas_width_mm REAL NOT NULL,
  canvas_height_mm REAL NOT NULL,
  elements JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_versions_project_idx ON project_versions (project_id, created_at DESC);
