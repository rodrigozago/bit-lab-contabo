/**
 * Notificação de nova solicitação de acesso (ADMIN-5) — webhook genérico,
 * configurável via ADMIN_NOTIFY_WEBHOOK_URL. Compatível com Slack (payload
 * `{text}`) e serviços que aceitam o mesmo formato (n8n, Discord via
 * endpoint slack-compatible, etc). Sem env definida, é um no-op.
 */
async function notifyAccessRequest({ email, appName }) {
  const url = process.env.ADMIN_NOTIFY_WEBHOOK_URL
  if (!url) return

  const adminUrl = `${process.env.ISSUER || ''}/admin`
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `🔔 ${email} pediu acesso ao ${appName}. Aprovar: ${adminUrl}`,
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch (err) {
    // notificação nunca deve derrubar o fluxo de login
    console.error('[notify] falha ao enviar webhook de notificação:', err.message)
  }
}

module.exports = { notifyAccessRequest }
