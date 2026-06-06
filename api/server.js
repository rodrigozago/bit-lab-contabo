const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const path = require('path')

const app = express()
const PORT = 3001

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

app.use(cors())
app.use(express.json())

app.post('/api/submit', (req, res) => {
  const { name, contact, genre } = req.body

  if (!name || !contact || !genre) {
    return res.status(400).json({ error: 'campos obrigatórios faltando' })
  }

  try {
    const result = insert.run({ name, contact, genre })
    res.json({ ok: true, id: result.lastInsertRowid })
  } catch (err) {
    res.status(500).json({ error: 'erro ao salvar' })
  }
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`api rodando em http://127.0.0.1:${PORT}`)
})
