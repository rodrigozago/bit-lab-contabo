-- Face Lab — schema (idempotente: a API roda este arquivo em todo boot)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('guest', 'producer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE album_status AS ENUM ('pending', 'scanning', 'ready', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
  distance real NOT NULL,
  status match_status NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (face_id, user_id)
);
CREATE INDEX IF NOT EXISTS matches_user_idx ON matches(user_id);

-- 1 linha por reconhecimento concluído — base do rate limiting/planos futuros
CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  album_id uuid REFERENCES albums(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_events_user_time_idx ON usage_events(user_id, created_at);
