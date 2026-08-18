const crypto = require('crypto')
const { pool } = require('../db')
const users = require('./users')

function hash(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

async function create(userId, ttlHours = 1) {
  const raw = crypto.randomBytes(32).toString('hex')
  const { rows } = await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' hours')::interval)
     RETURNING id, expires_at`,
    [userId, hash(raw), ttlHours]
  )
  return { ...rows[0], raw }
}

async function findValidByToken(raw) {
  const { rows } = await pool.query(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [hash(raw)]
  )
  return rows[0] || null
}

/** Marca usado (uso único) e troca a senha — a validade do token JÁ É a
 * autenticação aqui, não se exige a senha atual (diferente de changeOwnPassword). */
async function redeem(tokenRow, newPassword) {
  const { rowCount } = await pool.query(
    `UPDATE password_reset_tokens SET used_at = now()
     WHERE id = $1 AND used_at IS NULL`,
    [tokenRow.id]
  )
  if (rowCount === 0) return false
  await users.resetPassword(tokenRow.user_id, newPassword)
  return true
}

module.exports = { create, findValidByToken, redeem }
