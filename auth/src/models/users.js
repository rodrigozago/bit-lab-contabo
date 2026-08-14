const bcrypt = require('bcryptjs')
const { pool } = require('../db')

const PUBLIC_COLUMNS = 'id, email, name, avatar_path, is_superuser, created_at'

async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])
  return rows[0] || null
}

async function findById(id) {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id])
  return rows[0] || null
}

async function list() {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY created_at ASC`)
  return rows
}

async function create({ email, password, isSuperuser = false }) {
  const hash = bcrypt.hashSync(password, 12)
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, is_superuser) VALUES ($1, $2, $3) RETURNING ${PUBLIC_COLUMNS}`,
    [email.toLowerCase(), hash, isSuperuser]
  )
  return rows[0]
}

async function resetPassword(id, password) {
  const hash = bcrypt.hashSync(password, 12)
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id])
}

async function remove(id) {
  await pool.query('DELETE FROM users WHERE id = $1', [id])
}

async function count() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users')
  return rows[0].count
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash)
}

// Self-service — quem chama já validou email/uniqueness antes (ver
// routes/auth.js), aqui só aplica. `updates` só pode ter name/email por
// design (nunca password_hash/is_superuser por essa função).
async function updateProfile(id, updates) {
  const fields = []
  const values = []
  let i = 1
  if ('name' in updates) {
    fields.push(`name = $${i++}`)
    values.push(updates.name)
  }
  if ('email' in updates) {
    fields.push(`email = $${i++}`)
    values.push(updates.email)
  }
  if (fields.length === 0) return findById(id)

  values.push(id)
  const { rows } = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${PUBLIC_COLUMNS}`,
    values
  )
  return rows[0]
}

async function updateAvatarPath(id, avatarPath) {
  const { rows } = await pool.query(
    `UPDATE users SET avatar_path = $1 WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [avatarPath, id]
  )
  return rows[0]
}

// Troca de senha self-service — diferente de resetPassword (admin-only, sem
// checar senha atual): aqui SEMPRE exige a senha atual, senão qualquer
// sessão sequestrada vira dono permanente da conta.
async function changeOwnPassword(id, currentPassword, newPassword) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id])
  const user = rows[0]
  if (!user) return { ok: false, error: 'usuário não encontrado' }
  if (!verifyPassword(user, currentPassword)) {
    return { ok: false, error: 'senha atual incorreta' }
  }
  await resetPassword(id, newPassword)
  return { ok: true }
}

module.exports = {
  findByEmail,
  findById,
  list,
  create,
  resetPassword,
  remove,
  count,
  verifyPassword,
  updateProfile,
  updateAvatarPath,
  changeOwnPassword,
}
