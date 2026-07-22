const { pool } = require('../db')

/** true se o usuário tem acesso concedido ao app pelo slug. */
async function hasAccess(userId, appSlug) {
  const { rows } = await pool.query(
    `SELECT 1 FROM app_access aa
     JOIN apps a ON a.id = aa.app_id
     WHERE aa.user_id = $1 AND a.slug = $2`,
    [userId, appSlug]
  )
  return rows.length > 0
}

async function grant(userId, appId, role = 'end_user') {
  await pool.query(
    `INSERT INTO app_access (user_id, app_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, app_id) DO UPDATE SET role = EXCLUDED.role`,
    [userId, appId, role]
  )
}

async function revoke(userId, appId) {
  await pool.query('DELETE FROM app_access WHERE user_id = $1 AND app_id = $2', [userId, appId])
}

/** Promove/rebaixa o papel de um acesso já concedido, sem revogar+reconceder. */
async function setRole(userId, appId, role) {
  const { rows } = await pool.query(
    'UPDATE app_access SET role = $3 WHERE user_id = $1 AND app_id = $2 RETURNING user_id',
    [userId, appId, role]
  )
  return rows[0] || null
}

/** Apps (+ papel) que UM usuário específico tem acesso — pra dashboard dele (não-admin). */
async function listForUser(userId) {
  const { rows } = await pool.query(
    `SELECT a.id AS app_id, a.slug, a.name, aa.role
     FROM app_access aa
     JOIN apps a ON a.id = aa.app_id
     WHERE aa.user_id = $1
     ORDER BY a.name ASC`,
    [userId]
  )
  return rows
}

/** Lista todos os acessos concedidos, com e-mail e slug já resolvidos (pro painel admin). */
async function list() {
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.email, a.id AS app_id, a.slug, a.name, aa.role
     FROM app_access aa
     JOIN users u ON u.id = aa.user_id
     JOIN apps a ON a.id = aa.app_id
     ORDER BY u.email ASC, a.name ASC`
  )
  return rows
}

module.exports = { hasAccess, grant, revoke, setRole, list, listForUser }
