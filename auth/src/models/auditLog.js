const { pool } = require('../db')

/**
 * Registra uma ação de admin na trilha de auditoria (tabela audit_log). Nunca
 * lança: falhar em auditar não pode derrubar a ação em si — só loga o erro.
 * Ver ponto-studio/docs/SEGURANCA-PRE-LANCAMENTO.md item 11.
 *
 * @param actor  { userId, email } do admin que fez a ação (req.user)
 * @param action string curta, ex: 'user.create', 'user.delete', 'user.reset_password',
 *               'access.grant', 'access.revoke'
 * @param target identificador do alvo (id/email do usuário afetado, slug do app...)
 * @param detail objeto opcional com contexto extra (vai como JSONB)
 */
async function record(actor, action, target, detail) {
  try {
    await pool.query(
      'INSERT INTO audit_log (actor_id, actor_email, action, target, detail) VALUES ($1, $2, $3, $4, $5)',
      [actor?.userId || null, actor?.email || null, action, target || null, detail ? JSON.stringify(detail) : null]
    )
  } catch (err) {
    console.error('[audit] falha ao gravar log de auditoria:', { action, target, err: err.message })
  }
}

module.exports = { record }
