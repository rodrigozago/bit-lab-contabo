const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const path = require('path')

const app = express()
const PORT = 3001

const ADMIN_HASH = bcrypt.hashSync('pist@ocult@2026', 12)
const LISTENING_ADMIN_HASH = bcrypt.hashSync('rz123456', 12)

// tokens válidos em memória — expiram ao reiniciar o servidor
const tokens = new Set()

const db = new Database(path.join(__dirname, 'submissions.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    genre TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS listening_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    album TEXT NOT NULL
  )
`)
db.exec(`INSERT OR IGNORE INTO listening_config (id, album) VALUES (1, 'Nenhum álbum')`)

const LIMIT = 6

const insert = db.prepare('INSERT INTO submissions (name, contact, genre) VALUES (@name, @contact, @genre)')
const selectAll = db.prepare('SELECT * FROM submissions ORDER BY created_at DESC')
const countAll = db.prepare('SELECT COUNT(*) as count FROM submissions')
const deleteById = db.prepare('DELETE FROM submissions WHERE id = ?')

const updateAlbum = db.prepare('UPDATE listening_config SET album = @album WHERE id = 1')
const getAlbum = db.prepare('SELECT album FROM listening_config WHERE id = 1')

app.use(cors())
app.use(express.json())

// ── público ────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  const { count } = countAll.get()
  res.json({ count, open: count < LIMIT })
})

app.post('/api/submit', (req, res) => {
  const { name, contact, genre } = req.body
  if (!name || !contact || !genre) {
    return res.status(400).json({ error: 'campos obrigatórios faltando' })
  }
  const { count } = countAll.get()
  if (count >= LIMIT) {
    return res.status(403).json({ error: 'inscrições encerradas' })
  }
  try {
    const result = insert.run({ name, contact, genre })
    res.json({ ok: true, id: result.lastInsertRowid })
  } catch {
    res.status(500).json({ error: 'erro ao salvar' })
  }
})

// ── admin ──────────────────────────────────────────────────

// ── listening ──────────────────────────────────────────────
app.get('/api/listening', (req, res) => {
  const row = getAlbum.get()
  res.json({ album: row ? row.album : '' })
})

app.post('/api/listening', (req, res) => {
  const { password, album } = req.body
  if (!password || !bcrypt.compareSync(password, LISTENING_ADMIN_HASH)) {
    return res.status(401).json({ error: 'senha incorreta' })
  }
  if (album === undefined) {
    return res.status(400).json({ error: 'album faltando' })
  }
  updateAlbum.run({ album })
  res.json({ ok: true })
})

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {}
  if (!password || !bcrypt.compareSync(password, ADMIN_HASH)) {
    return res.status(401).json({ error: 'senha incorreta' })
  }
  const token = crypto.randomBytes(32).toString('hex')
  tokens.add(token)
  res.json({ token })
})

function authAdmin(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.replace('Bearer ', '')
  if (!tokens.has(token)) return res.status(401).json({ error: 'não autorizado' })
  next()
}

app.get('/api/admin/submissions', authAdmin, (req, res) => {
  res.json(selectAll.all())
})

app.delete('/api/admin/submissions/:id', authAdmin, (req, res) => {
  deleteById.run(req.params.id)
  res.json({ ok: true })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`api rodando em http://127.0.0.1:${PORT}`)
})
