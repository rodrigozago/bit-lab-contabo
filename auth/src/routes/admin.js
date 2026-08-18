const express = require('express')
const usersModel = require('../models/users')
const appsModel = require('../models/apps')
const appAccessModel = require('../models/appAccess')
const signupTokensModel = require('../models/signupTokens')
const auditLog = require('../models/auditLog')
const mailClient = require('../mailClient')
const { defaultInviteBody } = require('../inviteTemplates')
const { renderVars } = require('../templateVars')
const { APP_DOMAINS } = require('../appDomains')
const { requireSession, requireSuperuser } = require('../middleware')

const router = express.Router()

router.use(requireSession, requireSuperuser)
router.use(express.json())

function handlePgError(err, res) {
  if (err.code === '23505') return res.status(409).json({ error: 'já existe' })
  console.error('[admin]', err)
  return res.status(500).json({ error: 'erro interno' })
}

// A tela em si virou a SPA (auth/web) servida em apps.bit-lab.tech — este
// redirect é só pra bookmark antigo de /admin não quebrar.
router.get('/', (req, res) => {
  res.redirect('https://apps.bit-lab.tech/admin')
})

// ── users ──────────────────────────────────────────────────────────────────
router.get('/api/users', async (req, res) => {
  res.json(await usersModel.list())
})

router.post('/api/users', async (req, res) => {
  const { email, password, isSuperuser } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email e senha são obrigatórios' })
  try {
    const created = await usersModel.create({ email, password, isSuperuser: !!isSuperuser })
    await auditLog.record(req.user, 'user.create', created.email, { isSuperuser: !!isSuperuser })
    res.json(created)
  } catch (err) {
    handlePgError(err, res)
  }
})

router.post('/api/users/:id/reset-password', async (req, res) => {
  const { password } = req.body
  if (!password) return res.status(400).json({ error: 'senha é obrigatória' })
  await usersModel.resetPassword(req.params.id, password)
  await auditLog.record(req.user, 'user.reset_password', req.params.id)
  res.json({ ok: true })
})

router.delete('/api/users/:id', async (req, res) => {
  await usersModel.remove(req.params.id)
  await auditLog.record(req.user, 'user.delete', req.params.id)
  res.json({ ok: true })
})

// ── apps ───────────────────────────────────────────────────────────────────
router.get('/api/apps', async (req, res) => {
  res.json(await appsModel.list())
})

router.post('/api/apps', async (req, res) => {
  const { slug, name } = req.body
  if (!slug || !name) return res.status(400).json({ error: 'slug e nome são obrigatórios' })
  try {
    res.json(await appsModel.create({ slug, name }))
  } catch (err) {
    handlePgError(err, res)
  }
})

router.patch('/api/apps/:id/self-signup', async (req, res) => {
  const { allowed } = req.body
  const app = await appsModel.setSelfSignup(req.params.id, !!allowed)
  if (!app) return res.status(404).json({ error: 'app não encontrado' })
  await auditLog.record(req.user, 'app.self_signup_toggle', app.slug, { allowed: !!allowed })
  res.json(app)
})

// Termo próprio do app (além do termo global do cadastro) — termsVersion
// vazio/null desliga o gate pra esse app. Ver docs do gate em
// routes/interaction.js (prompt "consent").
router.patch('/api/apps/:id/terms', async (req, res) => {
  const { termsVersion, termsUrl } = req.body
  const app = await appsModel.setTerms(req.params.id, { termsVersion, termsUrl })
  if (!app) return res.status(404).json({ error: 'app não encontrado' })
  await auditLog.record(req.user, 'app.terms_update', app.slug, { termsVersion: termsVersion || null, termsUrl: termsUrl || null })
  res.json(app)
})

router.delete('/api/apps/:id', async (req, res) => {
  await appsModel.remove(req.params.id)
  res.json({ ok: true })
})

// ── access ─────────────────────────────────────────────────────────────────
router.get('/api/access', async (req, res) => {
  res.json(await appAccessModel.list())
})

router.post('/api/access', async (req, res) => {
  const { userId, appId, role } = req.body
  if (!userId || !appId) return res.status(400).json({ error: 'userId e appId são obrigatórios' })
  if (role && !['end_user', 'app_admin'].includes(role)) return res.status(400).json({ error: 'role inválido' })
  await appAccessModel.grant(userId, appId, role || 'end_user')
  await auditLog.record(req.user, 'access.grant', userId, { appId, role: role || 'end_user' })
  res.json({ ok: true })
})

router.patch('/api/access/:userId/:appId/role', async (req, res) => {
  const { role } = req.body
  if (!['end_user', 'app_admin'].includes(role)) return res.status(400).json({ error: 'role inválido' })
  const updated = await appAccessModel.setRole(req.params.userId, req.params.appId, role)
  if (!updated) return res.status(404).json({ error: 'acesso não encontrado' })
  await auditLog.record(req.user, 'access.role_change', req.params.userId, { appId: req.params.appId, role })
  res.json({ ok: true })
})

router.delete('/api/access/:userId/:appId', async (req, res) => {
  await appAccessModel.revoke(req.params.userId, req.params.appId)
  await auditLog.record(req.user, 'access.revoke', req.params.userId, { appId: req.params.appId })
  res.json({ ok: true })
})

// ── links de convite ─────────────────────────────────────────────────────
router.get('/api/signup-tokens', async (req, res) => {
  res.json(await signupTokensModel.list())
})

// GET /api/invite-template?appId=<uuid> — texto padrão (editável) do corpo do
// convite pra pré-carregar o editor rico no painel. Sem appId (ou mais de um
// app selecionado — o front só manda um), cai no texto genérico. Variáveis
// ({name}/{app}/{domain}/{url}) ficam literais aqui — só são substituídas na
// hora de enviar de verdade (POST abaixo).
router.get('/api/invite-template', async (req, res) => {
  const { appId } = req.query
  const app = appId ? await appsModel.findByIds([appId]).then((rows) => rows[0]) : null
  res.json({ bodyHtml: defaultInviteBody(app?.slug) })
})

router.post('/api/signup-tokens', async (req, res) => {
  const { role, email, appIds, ttlHours, name, emailBodyHtml } = req.body
  if (!['end_user', 'app_admin'].includes(role)) return res.status(400).json({ error: 'role inválido' })
  if (!Array.isArray(appIds) || appIds.length === 0) return res.status(400).json({ error: 'selecione pelo menos um app' })

  const token = await signupTokensModel.create({
    role, email: email || null, appIds, createdBy: req.user.userId, ttlHours: ttlHours || undefined,
  })
  await auditLog.record(req.user, 'signup_token.create', token.id, { role, email: email || null, appIds })
  const url = `https://apps.bit-lab.tech/signup?token=${token.raw}`
  // Texto do e-mail depende do(s) app(s) concedidos — só quando o convite dá
  // acesso a UM único app é que dá pra escolher um texto específico dele (ex.:
  // convite do alfa do bordado-digital). Convite pra vários apps de uma vez
  // cai no texto genérico (ver email/src/templates/invite.js).
  if (email) {
    const grantedApps = await appsModel.findByIds(appIds)
    const singleApp = grantedApps.length === 1 ? grantedApps[0] : null
    const appSlug = singleApp?.slug
    const vars = {
      name: (name || '').trim() || email.split('@')[0],
      app: singleApp?.name || 'bit-lab',
      domain: (appSlug && APP_DOMAINS[appSlug]) || 'bit-lab.tech',
      url,
    }
    // Corpo vem do editor rico (já pode ter sido editado pelo admin) ou do
    // texto padrão daquele app — nos dois casos as variáveis literais só são
    // substituídas aqui, na hora de enviar de verdade.
    const bodySource = emailBodyHtml || defaultInviteBody(appSlug)
    const customBodyHtml = renderVars(bodySource, vars)
    // Falha no envio não bloqueia a criação do convite — o superuser sempre
    // pode copiar o link da resposta abaixo como fallback (ver mailClient.js).
    mailClient.sendInvite({ to: email, url, expiresAt: token.expires_at, appSlug, customBodyHtml })
  }
  res.json({ id: token.id, url, expiresAt: token.expires_at })
})

router.delete('/api/signup-tokens/:id', async (req, res) => {
  const revoked = await signupTokensModel.revoke(req.params.id)
  if (!revoked) return res.status(404).json({ error: 'convite não encontrado ou já usado' })
  await auditLog.record(req.user, 'signup_token.revoke', req.params.id)
  res.json({ ok: true })
})

module.exports = router
