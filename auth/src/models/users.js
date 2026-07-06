const bcrypt = require('bcryptjs')
const { pool } = require('../db')

const PUBLIC_COLUMNS = 'id, email, is_admin, created_at'

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

async function create({ email, password, isAdmin = false }) {
  const hash = bcrypt.hashSync(password, 12)
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, is_admin) VALUES ($1, $2, $3) RETURNING ${PUBLIC_COLUMNS}`,
    [email.toLowerCase(), hash, isAdmin]
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

module.exports = { findByEmail, findById, list, create, resetPassword, remove, count, verifyPassword }
