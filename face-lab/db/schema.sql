-- Face Lab — schema (idempotente: a API roda este arquivo em todo boot)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('guest', 'producer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE album_status AS ENUM ('pending', 'scanning', 'ready', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- arquivado: retenção venceu (90 dias sem re-scan) — mídia biométrica apagada,
-- álbum/fotos/metadados continuam existindo; re-escanear desarquiva
ALTER TYPE album_status ADD VALUE IF NOT EXISTS 'archived';

DO $$ BEGIN
  CREATE TYPE photo_status AS ENUM ('pending', 'processing', 'done', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM ('pending', 'done', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('auto', 'confirmed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- identidade vem do SSO (auth.bit-lab.tech): oidc_sub = users.id do auth
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oidc_sub text UNIQUE NOT NULL,
  email text NOT NULL,
  display_name text,
  role user_role NOT NULL DEFAULT 'guest',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- marca até quando o sino de notificações já foi visto (matches criados depois = não lidos)
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_seen_at timestamptz;
-- backfill idempotente: só afeta quem nunca teve a coluna setada — não repete a cada boot
-- pra quem já tem valor, evita "N fotos novas" retroativas pra contas anteriores ao recurso
UPDATE users SET notifications_seen_at = now() WHERE notifications_seen_at IS NULL;

-- consentimento LGPD: aceite geral dos Termos/Privacidade + consentimento
-- ESPECÍFICO pro processamento biométrico facial (Art. 11 — dado sensível, não
-- pode ser coberto pelo aceite geral). Sem backfill: contas existentes ficam
-- NULL e caem no gate de consentimento no próximo login, mesmo sendo antigas.
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS biometric_consent_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS biometric_consent_version text;

-- uma conta Google por producer; refresh token AES-256-GCM (iv||tag||cipher)
CREATE TABLE IF NOT EXISTS google_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  refresh_token_enc bytea NOT NULL,
  scopes text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  drive_folder_id text NOT NULL,
  status album_status NOT NULL DEFAULT 'pending',
  error text,
  scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS albums_owner_idx ON albums(owner_id);

-- marca d'água nas thumbs, liga/desliga sem reprocessar (composta em tempo de resposta)
ALTER TABLE albums ADD COLUMN IF NOT EXISTS watermark_enabled boolean NOT NULL DEFAULT true;
-- atestado do producer de que os convidados do evento foram informados/consentiram
-- com o reconhecimento facial nas fotos (LGPD — quem aparece nas fotos ainda não logou)
ALTER TABLE albums ADD COLUMN IF NOT EXISTS guest_consent_attested_at timestamptz;

-- originais NUNCA são armazenados: só metadados, links do Drive e thumb própria
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  name text NOT NULL,
  mime_type text NOT NULL,
  width int,
  height int,
  taken_at timestamptz,
  web_view_link text,
  web_content_link text,
  thumb_path text,
  status photo_status NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (album_id, drive_file_id)
);
CREATE INDEX IF NOT EXISTS photos_album_idx ON photos(album_id);

CREATE TABLE IF NOT EXISTS faces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  bbox jsonb NOT NULL,
  det_score real NOT NULL,
  crop_path text NOT NULL,
  embedding vector(512) NOT NULL
);
CREATE INDEX IF NOT EXISTS faces_photo_idx ON faces(photo_id);

-- "pessoa" = cluster de faces do mesmo álbum (centroide = média L2-normalizada)
CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  centroid vector(512) NOT NULL,
  face_count int NOT NULL DEFAULT 0,
  cover_face_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS people_album_idx ON people(album_id);

ALTER TABLE faces ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES people(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS faces_person_idx ON faces(person_id);

-- "não sou eu" por pessoa — persiste pra faces futuras do mesmo cluster
CREATE TABLE IF NOT EXISTS rejected_people (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, person_id)
);
-- sem índice vetorial por enquanto (scan exato ok até ~100k faces);
-- quando crescer: CREATE INDEX faces_embedding_idx ON faces USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  embedding vector(512),
  status enrollment_status NOT NULL DEFAULT 'pending',
  error text,
  source text NOT NULL DEFAULT 'webcam',
  frame_count int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enrollments_user_idx ON enrollments(user_id);

CREATE TABLE IF NOT EXISTS matches (
  face_id uuid NOT NULL REFERENCES faces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  -- nullable: autoidentificação manual ("Todas as fotos") sem enrollment ativo
  -- não tem distância de embedding pra registrar
  distance real,
  status match_status NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (face_id, user_id)
);
ALTER TABLE matches ALTER COLUMN distance DROP NOT NULL;
CREATE INDEX IF NOT EXISTS matches_user_idx ON matches(user_id);

-- portfólio público do fotógrafo (/p/:slug) — 1 página por producer
CREATE TABLE IF NOT EXISTS producer_pages (
  owner_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'),
  display_name text NOT NULL,
  hero_photo_id uuid REFERENCES photos(id) ON DELETE SET NULL,
  editorial_md text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS producer_pages_slug_idx ON producer_pages (lower(slug));

-- featured_at NULL = privado (default); setado = exibido no portfólio público
ALTER TABLE albums ADD COLUMN IF NOT EXISTS featured_at timestamptz;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS featured_at timestamptz;
-- thumb SEM marca d'água, gerada sob demanda só pras fotos featured (thumbs-clean/)
ALTER TABLE photos ADD COLUMN IF NOT EXISTS clean_thumb_path text;
CREATE INDEX IF NOT EXISTS photos_featured_idx ON photos(album_id) WHERE featured_at IS NOT NULL;

-- 1 linha por reconhecimento concluído — base do rate limiting/planos futuros
CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  album_id uuid REFERENCES albums(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_events_user_time_idx ON usage_events(user_id, created_at);
