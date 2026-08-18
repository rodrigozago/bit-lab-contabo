const crypto = require('crypto')
const { pool } = require('../db')
const users = require('./users')

function hash(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

async function create(userId, ttlHours = 48) {
  const raw = crypto.randomBytes(32).toString('hex')
  const { rows } = await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' hours')::interval)
     RETURNING id, expires_at`,
    [userId, hash(raw), ttlHours]
  )
  return { ...rows[0], raw }
}

async function findValidByToken(raw) {
  const { rows } = await pool.query(
    `SELECT * FROM email_verification_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [hash(raw)]
  )
  return rows[0] || null
}

async function redeem(tokenRow) {
  const { rowCount } = await pool.query(
    `UPDATE email_verification_tokens SET used_at = now()
     WHERE id = $1 AND used_at IS NULL`,
    [tokenRow.id]
  )
  if (rowCount === 0) return false
  await users.markEmailVerified(tokenRow.user_id)
  return true
}

module.exports = { create, findValidByToken, redeem }
