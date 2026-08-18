const { pool } = require('../db')

/** scope = 'global' (termo geral, aceito no cadastro) ou o slug de um app
 * (termo próprio daquele app, ver apps.terms_version). */
async function record(userId, scope, version) {
  await pool.query(
    `INSERT INTO legal_acceptances (user_id, scope, version)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, scope, version) DO NOTHING`,
    [userId, scope, version]
  )
}

async function hasAccepted(userId, scope, version) {
  const { rows } = await pool.query(
    `SELECT 1 FROM legal_acceptances WHERE user_id = $1 AND scope = $2 AND version = $3`,
    [userId, scope, version]
  )
  return rows.length > 0
}

module.exports = { record, hasAccepted }
