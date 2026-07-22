const { pool } = require('../db')
const appAccess = require('./appAccess')

/**
 * Cria uma solicitação pendente se ainda não existir uma pro par usuário+app.
 * Retorna a row inserida, ou null se já havia uma pendente (ON CONFLICT) —
 * o retorno permite ao chamador notificar o admin só em inserção REAL
 * (ADMIN-5), sem spam a cada retry de login sem acesso.
 */
async function ensurePending(userId, appId) {
  const { rows } = await pool.query(
    `INSERT INTO access_requests (user_id, app_id, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (user_id, app_id) WHERE status = 'pending' DO NOTHING
     RETURNING id`,
    [userId, appId]
  )
  return rows[0] || null
}

/** Lista solicitações pendentes, com e-mail e slug já resolvidos (pro painel admin). */
async function listPending() {
  const { rows } = await pool.query(
    `SELECT ar.id, u.id AS user_id, u.email, a.id AS app_id, a.slug, a.name, ar.requested_at
     FROM access_requests ar
     JOIN users u ON u.id = ar.user_id
     JOIN apps a ON a.id = ar.app_id
     WHERE ar.status = 'pending'
     ORDER BY ar.requested_at ASC`
  )
  return rows
}

/** Aprova: marca a solicitação e concede app_access. */
async function approve(id, decidedBy) {
  const { rows } = await pool.query(
    `UPDATE access_requests SET status = 'approved', decided_at = now(), decided_by = $2
     WHERE id = $1 AND status = 'pending'
     RETURNING user_id, app_id`,
    [id, decidedBy]
  )
  const request = rows[0]
  if (!request) return null
  // Aprovação pela fila sempre concede 'end_user' — app_admin só sai de
  // convite explícito do superuser (link/token), nunca de auto-aprovação.
  await appAccess.grant(request.user_id, request.app_id, 'end_user')
  return request
}

/** Recusa: só marca a solicitação, não concede acesso. */
async function reject(id, decidedBy) {
  const { rows } = await pool.query(
    `UPDATE access_requests SET status = 'rejected', decided_at = now(), decided_by = $2
     WHERE id = $1 AND status = 'pending'
     RETURNING user_id, app_id`,
    [id, decidedBy]
  )
  return rows[0] || null
}

module.exports = { ensurePending, listPending, approve, reject }
