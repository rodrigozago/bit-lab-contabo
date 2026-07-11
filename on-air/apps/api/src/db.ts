import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { utcIsoToSpWall } from './time.js'

const DB_DIR = process.env['DB_DIR'] ?? path.resolve('.data')
export const MEDIA_DIR = process.env['MEDIA_DIR'] ?? path.join(DB_DIR, 'media')

fs.mkdirSync(DB_DIR, { recursive: true })
fs.mkdirSync(MEDIA_DIR, { recursive: true })

const db = new Database(path.join(DB_DIR, 'on-air.db'))
db.pragma('journal_mode = WAL')

// migrate-on-boot: schema idempotente (CREATE IF NOT EXISTS).
// No container o Dockerfile copia db/schema.sql pra ../db (relativo a dist/);
// em dev o arquivo vive na raiz do app (../../../db relativo a src/).
const here = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = [
  path.join(here, '../db/schema.sql'),
  path.join(here, '../../../db/schema.sql'),
].find((p) => fs.existsSync(p))
if (!schemaPath) throw new Error('db/schema.sql não encontrado')
db.exec(fs.readFileSync(schemaPath, 'utf8'))

export interface SlotRow {
  id: number
  artist: string
  genre: string
  image_file: string | null
  starts_at: string
  ends_at: string
}

export interface SlotJson {
  id: number
  artist: string
  genre: string
  image_url: string | null
  starts_at: string
  ends_at: string
  starts_at_local: string
  ends_at_local: string
}

/** Formato que a web consome: URL da foto + horários já na parede de São Paulo. */
export function serializeSlot(row: SlotRow): SlotJson {
  return {
    id: row.id,
    artist: row.artist,
    genre: row.genre,
    image_url: row.image_file ? `/api/media/${row.image_file}` : null,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    starts_at_local: utcIsoToSpWall(row.starts_at),
    ends_at_local: utcIsoToSpWall(row.ends_at),
  }
}

export const stmts = {
  current: db.prepare<[string, string], SlotRow>(
    'SELECT * FROM slots WHERE starts_at <= ? AND ends_at > ? ORDER BY starts_at LIMIT 1'
  ),
  upcoming: db.prepare<[string], SlotRow>(
    'SELECT * FROM slots WHERE starts_at > ? ORDER BY starts_at ASC'
  ),
  past: db.prepare<[string], SlotRow>(
    'SELECT * FROM slots WHERE ends_at <= ? ORDER BY ends_at DESC LIMIT 20'
  ),
  all: db.prepare<[], SlotRow>('SELECT * FROM slots ORDER BY starts_at ASC'),
  byId: db.prepare<[number], SlotRow>('SELECT * FROM slots WHERE id = ?'),
  overlapping: db.prepare<[string, string, number], { n: number }>(
    'SELECT COUNT(*) AS n FROM slots WHERE starts_at < ? AND ends_at > ? AND id != ?'
  ),
  insert: db.prepare<[string, string, string | null, string, string]>(
    'INSERT INTO slots (artist, genre, image_file, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)'
  ),
  update: db.prepare<[string, string, string | null, string, string, number]>(
    `UPDATE slots SET artist = ?, genre = ?, image_file = ?, starts_at = ?, ends_at = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`
  ),
  remove: db.prepare<[number]>('DELETE FROM slots WHERE id = ?'),
}

export default db
