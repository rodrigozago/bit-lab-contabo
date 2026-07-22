const crypto = require('crypto')
const { pool } = require('../db')

function hash(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

/**
 * Gera um link de convite. O token bruto só existe aqui (retorno) e na URL
 * que o superuser copia/envia — o banco guarda só o hash, então nem um dump
 * do Postgres revela convites válidos.
 */
async function create({ role, email, appIds, createdBy, ttlHours = 168 }) {
  const raw = crypto.randomBytes(32).toString('hex')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO signup_tokens (token_hash, role, email, created_by, expires_at)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' hours')::interval)
       RETURNING id, role, email, expires_at, created_at`,
      [hash(raw), role, email || null, createdBy, ttlHours]
    )
    const token = rows[0]
    for (const appId of appIds) {
      await client.query(
        'INSERT INTO signup_token_apps (token_id, app_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [token.id, appId]
      )
    }
    await client.query('COMMIT')
    return { ...token, raw }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** Busca um token válido (existe, não usado, não expirado) pelo valor bruto da URL. */
async function findValidByToken(raw) {
  const { rows } = await pool.query(
    `SELECT * FROM signup_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [hash(raw)]
  )
  return rows[0] || null
}

/** Apps vinculados a um token (id + slug + nome), pra resgate e pro painel. */
async function appsFor(tokenId) {
  const { rows } = await pool.query(
    `SELECT a.id, a.slug, a.name
     FROM signup_token_apps sta
     JOIN apps a ON a.id = sta.app_id
     WHERE sta.token_id = $1`,
    [tokenId]
  )
  return rows
}

/** Resgata: marca usado (uso único) e concede app_access com o role do token pra cada app. */
async function redeem(tokenRow, userId) {
  const { rowCount } = await pool.query(
    `UPDATE signup_tokens SET used_at = now(), used_by = $2
     WHERE id = $1 AND used_at IS NULL`,
    [tokenRow.id, userId]
  )
  if (rowCount === 0) return false

  const appAccess = require('./appAccess')
  const apps = await appsFor(tokenRow.id)
  for (const app of apps) {
    await appAccess.grant(userId, app.id, tokenRow.role)
  }
  return true
}

/** Lista convites (ativos e histórico), com apps vinculados e e-mail de quem resgatou. */
async function list() {
  const { rows } = await pool.query(
    `SELECT st.id, st.role, st.email, st.expires_at, st.used_at, st.created_at,
            creator.email AS created_by_email, redeemer.email AS used_by_email
     FROM signup_tokens st
     JOIN users creator ON creator.id = st.created_by
     LEFT JOIN users redeemer ON redeemer.id = st.used_by
     ORDER BY st.created_at DESC`
  )
  const apps = await pool.query(
    `SELECT sta.token_id, a.id, a.slug, a.name
     FROM signup_token_apps sta
     JOIN apps a ON a.id = sta.app_id`
  )
  const appsByToken = new Map()
  for (const row of apps.rows) {
    const list = appsByToken.get(row.token_id) || []
    list.push({ id: row.id, slug: row.slug, name: row.name })
    appsByToken.set(row.token_id, list)
  }
  return rows.map((row) => ({ ...row, apps: appsByToken.get(row.id) || [] }))
}

/** Revoga um convite não usado (expira imediatamente). */
async function revoke(id) {
  const { rows } = await pool.query(
    `UPDATE signup_tokens SET expires_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id`,
    [id]
  )
  return rows[0] || null
}

module.exports = { create, findValidByToken, appsFor, redeem, list, revoke }
