const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const path = require('path')

const app = express()
const PORT = 3001

const ADMIN_HASH = bcrypt.hashSync('pist@ocult@2026', 12)

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

const insert = db.prepare('INSERT INTO submissions (name, contact, genre) VALUES (@name, @contact, @genre)')
const selectAll = db.prepare('SELECT * FROM submissions ORDER BY created_at DESC')
const deleteById = db.prepare('DELETE FROM submissions WHERE id = ?')

app.use(cors())
app.use(express.json())

// ── público ────────────────────────────────────────────────

app.post('/api/submit', (req, res) => {
  const { name, contact, genre } = req.body
  if (!name || !contact || !genre) {
    return res.status(400).json({ error: 'campos obrigatórios faltando' })
  }
  try {
    const result = insert.run({ name, contact, genre })
    res.json({ ok: true, id: result.lastInsertRowid })
  } catch {
    res.status(500).json({ error: 'erro ao salvar' })
  }
})

// ── admin ──────────────────────────────────────────────────

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
