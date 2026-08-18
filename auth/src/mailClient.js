const { rollbar } = require('./rollbar')

/**
 * Cliente fino do microserviço email/ (mail.bit-lab.tech) — ver email/README.md
 * pro porquê de ser um serviço separado em vez de integrar o Resend aqui
 * direto. Falha no envio NUNCA derruba o fluxo que chamou (convite, reset de
 * senha, verificação de e-mail): loga no Rollbar e deixa o caller decidir o
 * fallback (o link continua disponível pra copiar/colar manualmente onde
 * aplicável).
 */
const MAIL_SERVICE_URL = process.env.MAIL_SERVICE_URL
const MAIL_INTERNAL_KEY = process.env.MAIL_INTERNAL_KEY

async function send(template, to, data) {
  if (!MAIL_SERVICE_URL || !MAIL_INTERNAL_KEY) {
    console.warn(`[mailClient] MAIL_SERVICE_URL/MAIL_INTERNAL_KEY não configurados — e-mail "${template}" não enviado.`)
    return { ok: false }
  }
  try {
    const res = await fetch(`${MAIL_SERVICE_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': MAIL_INTERNAL_KEY },
      body: JSON.stringify({ template, to, data }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`email service respondeu ${res.status}: ${body}`)
    }
    return { ok: true }
  } catch (err) {
    console.error(`[mailClient] falha ao enviar "${template}" pra ${to}:`, err.message)
    if (rollbar) rollbar.error(err, { template, to })
    return { ok: false }
  }
}

const sendInvite = ({ to, url, expiresAt, appSlug }) => send('invite', to, { url, expiresAt, appSlug })
const sendPasswordReset = ({ to, url }) => send('password-reset', to, { url })
const sendEmailVerification = ({ to, url }) => send('email-verification', to, { url })

module.exports = { sendInvite, sendPasswordReset, sendEmailVerification }
