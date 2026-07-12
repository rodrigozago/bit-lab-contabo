-- Schema do On Air — aplicado idempotente em todo boot da API (migrate-on-boot).
-- Datas sempre em ISO-8601 UTC ("...Z"): largura fixa, então comparação de
-- string == comparação temporal (o "tocando agora" depende disso).

CREATE TABLE IF NOT EXISTS slots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  artist      TEXT NOT NULL,
  genre       TEXT NOT NULL,
  image_file  TEXT,               -- nome do arquivo dentro de MEDIA_DIR (slot-<uuid>.<ext>)
  instagram   TEXT,               -- @usuario ou URL completa (vira QR code na página pública)
  starts_at   TEXT NOT NULL,      -- ISO-8601 UTC
  ends_at     TEXT NOT NULL,      -- ISO-8601 UTC, sempre > starts_at
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_slots_starts_at ON slots(starts_at);
