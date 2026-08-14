const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const users = require('../models/users')
const apps = require('../models/apps')
const appAccess = require('../models/appAccess')
const signupTokens = require('../models/signupTokens')
const auditLog = require('../models/auditLog')
const session = require('../session')
const { checkLimit } = require('../rateLimit')
const { requireSession } = require('../middleware')
const { renderLogin, renderSignup, renderMessage } = require('../views/login')
const { MEDIA_DIR, AVATAR_DIR, avatarUrl } = require('../media')

const router = express.Router()

const AVATAR_MIME_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: AVATAR_DIR,
    filename: (req, file, cb) => {
      const ext = AVATAR_MIME_EXT[file.mimetype] || ''
      cb(null, `${req.user.userId}-${Date.now()}${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!AVATAR_MIME_EXT[file.mimetype]) {
      return cb(new Error('formato inválido — use PNG, JPEG ou WEBP'))
    }
    cb(null, true)
  },
})

function toMe(user) {
  return {
    email: user.email,
    name: user.name || null,
    avatarUrl: avatarUrl(user.avatar_path),
    isSuperuser: !!user.is_superuser,
  }
}

function safeRedirectPath(raw) {
  // Permite redirect pra URLs *.bit-lab.tech (https) ou paths locais — evita open-redirect.
  if (!raw) return null
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  try {
    const url = new URL(raw)
    if (url.protocol === 'https:' && /(^|\.)bit-lab\.tech$/.test(url.hostname)) return raw
  } catch {
    // não é URL absoluta válida — ignora
  }
  return null
}

router.get('/login', (req, res) => {
  res.type('html').send(renderLogin({ redirect: req.query.redirect }))
})

router.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
  const { email, password, redirect } = req.body
  const ip = req.ip || 'unknown'

  // Dois limites: por (IP+email) contra brute-force numa conta específica, E
  // por IP puro contra um atacante que ROTACIONA o e-mail pra escapar do
  // limite por conta. Ver ponto-studio/docs/SEGURANCA-PRE-LANCAMENTO.md item 17.
  const okPerAccount = await checkLimit(`login:${ip}:${(email || '').toLowerCase()}`, 10, 15 * 60)
  const okPerIp = await checkLimit(`login-ip:${ip}`, 50, 15 * 60)
  if (!okPerAccount || !okPerIp) {
    return res.status(429).type('html').send(renderLogin({
      error: 'Muitas tentativas — tente de novo em alguns minutos.', redirect,
    }))
  }

  const user = email && (await users.findByEmail(email))
  if (!user || !users.verifyPassword(user, password || '')) {
    return res.status(401).type('html').send(renderLogin({ error: 'E-mail ou senha incorretos.', redirect }))
  }

  await session.create(res, user)
  const target = safeRedirectPath(redirect) || 'https://apps.bit-lab.tech/'
  res.redirect(target)
})

router.post('/logout', async (req, res) => {
  await session.destroy(req, res)
  res.redirect('/login')
})

// Logout SSO (chamado pelos apps, ex: face-lab): derruba a bl_session E a
// sessão própria do oidc-provider (senão o próximo /auth pula o login de novo),
// depois volta pro app. GET porque é um redirect cross-app (padrão OIDC logout).
router.get('/logout', async (req, res) => {
  await session.destroy(req, res)
  res.clearCookie('_session', { path: '/' })
  res.clearCookie('_session.legacy', { path: '/' })
  const target = safeRedirectPath(req.query.redirect) || '/login'
  res.redirect(target)
})

// Signup: só dois jeitos de chegar aqui, não tem mais auto-cadastro "aberto".
//  1) ?token=<x>   — resgate de convite gerado pelo superuser (sempre permitido).
//  2) ?app=<slug>  — self-signup clássico, só se aquele app tiver allow_self_signup=true.
// Sem um dos dois → 404 (mesmo comportamento de "desligado").
router.get('/signup', async (req, res) => {
  const { token, app: appSlug, redirect } = req.query

  if (token) {
    const tokenRow = await signupTokens.findValidByToken(token)
    if (!tokenRow) {
      return res.status(410).type('html').send(renderMessage({
        title: 'Convite inválido',
        message: 'Este link de convite não existe mais, já foi usado ou expirou. Peça um novo link a quem te convidou.',
      }))
    }
    return res.type('html').send(renderSignup({ redirect, token, lockedEmail: tokenRow.email }))
  }

  if (appSlug) {
    const app = await apps.findBySlug(appSlug)
    if (!app || !app.allow_self_signup) return res.status(404).end()
    return res.type('html').send(renderSignup({ redirect, app: appSlug }))
  }

  return res.status(404).end()
})

// GET /invite/redeem — pra quem já tem conta bit-lab e clicou "Já tenho
// conta" na tela de convite. requireSession já cuida do caso "não tá logado
// ainda": redireciona pro /login?redirect=/invite/redeem?token=... e volta
// pra cá sozinho depois — só então o convite é resgatado pra essa conta.
router.get('/invite/redeem', requireSession, async (req, res) => {
  const { token, redirect } = req.query
  if (!token) {
    return res.status(400).type('html').send(renderMessage({
      title: 'Link inválido', message: 'Esse link está sem o token do convite.',
    }))
  }

  const tokenRow = await signupTokens.findValidByToken(token)
  if (!tokenRow) {
    return res.status(410).type('html').send(renderMessage({
      title: 'Convite inválido',
      message: 'Este link de convite não existe mais, já foi usado ou expirou. Peça um novo link a quem te convidou.',
    }))
  }
  if (tokenRow.email && tokenRow.email.toLowerCase() !== req.user.email.toLowerCase()) {
    return res.status(403).type('html').send(renderMessage({
      title: 'Convite não é pra essa conta',
      message: `Este convite é só pro e-mail ${tokenRow.email} — entre com essa conta ou peça um novo link.`,
    }))
  }

  await signupTokens.redeem(tokenRow, req.user.userId)
  res.redirect(safeRedirectPath(redirect) || 'https://apps.bit-lab.tech/')
})

router.post('/signup', express.urlencoded({ extended: false }), async (req, res) => {
  const { email, password, password2, redirect, token, app: appSlug } = req.body
  const ip = req.ip || 'unknown'
  const fail = (status, error) => res.status(status).type('html').send(renderSignup({ error, redirect, token, app: appSlug }))

  const okRate = await checkLimit(`signup:${ip}`, 5, 60 * 60)
  if (!okRate) return fail(429, 'Muitas contas criadas — tente de novo mais tarde.')

  const cleanEmail = (email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return fail(400, 'E-mail inválido.')
  if (!password || password.length < 8) return fail(400, 'A senha precisa ter pelo menos 8 caracteres.')
  if (password !== password2) return fail(400, 'As senhas não conferem.')

  let tokenRow = null
  let selfSignupApp = null

  if (token) {
    tokenRow = await signupTokens.findValidByToken(token)
    if (!tokenRow) return fail(410, 'Este convite não é mais válido — peça um novo link.')
    if (tokenRow.email && tokenRow.email.toLowerCase() !== cleanEmail) {
      return fail(400, 'Este convite é pra um e-mail específico.')
    }
  } else if (appSlug) {
    selfSignupApp = await apps.findBySlug(appSlug)
    if (!selfSignupApp || !selfSignupApp.allow_self_signup) return res.status(404).end()
  } else {
    return res.status(404).end()
  }

  if (await users.findByEmail(cleanEmail)) return fail(409, 'Já existe uma conta com esse e-mail.')

  const user = await users.create({ email: cleanEmail, password })

  if (tokenRow) {
    await signupTokens.redeem(tokenRow, user.id)
  } else {
    await appAccess.grant(user.id, selfSignupApp.id, 'end_user')
  }

  await session.create(res, user)
  res.redirect(safeRedirectPath(redirect) || 'https://apps.bit-lab.tech/')
})

// GET /verify — alvo do `auth_request` do nginx.
// 401 sem sessão válida · 403 sessão válida mas sem acesso ao app pedido · 200 ok
router.get('/verify', async (req, res) => {
  const current = await session.read(req)
  if (!current) return res.status(401).end()

  const appSlug = req.query.app
  if (appSlug) {
    const allowed = await appAccess.hasAccess(current.userId, appSlug)
    if (!allowed) return res.status(403).end()
  }

  res.set('X-User-Email', current.email)
  res.status(200).end()
})

// GET /api/me — usado pela SPA (apps.bit-lab.tech) pra saber se há sessão e
// qual o papel do usuário. O cookie bl_session (Domain=.bit-lab.tech) já
// chega sozinho em qualquer subdomínio, sem precisar de dança OIDC própria.
// Busca fresco no banco (não só o que tá cacheado na sessão) — mesmo
// princípio do requireSuperuser em middleware.js: editar o perfil precisa
// refletir aqui na mesma hora, sem esperar relogar.
router.get('/api/me', async (req, res) => {
  const current = await session.read(req)
  if (!current) return res.status(401).json({ error: 'não autenticado' })
  const user = await users.findById(current.userId)
  if (!user) return res.status(401).json({ error: 'não autenticado' })
  res.json(toMe(user))
})

// PATCH /api/me — nome e/ou e-mail. Sem verificação de e-mail por link (mesma
// ressalva de email_verified em src/oidc.js) — troca é direta, só checa
// formato e unicidade.
router.patch('/api/me', requireSession, express.json(), async (req, res) => {
  const { name, email } = req.body
  const updates = {}

  if (typeof name === 'string') {
    updates.name = name.trim().slice(0, 100) || null
  }

  if (typeof email === 'string') {
    const cleanEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'e-mail inválido' })
    }
    if (cleanEmail !== req.user.email) {
      const existing = await users.findByEmail(cleanEmail)
      if (existing) return res.status(409).json({ error: 'já existe uma conta com esse e-mail' })
      updates.email = cleanEmail
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'nada pra atualizar' })
  }

  const updated = await users.updateProfile(req.user.userId, updates)
  await auditLog.record(req.user, 'user.self_update', req.user.email, updates)
  res.json(toMe(updated))
})

// PATCH /api/me/password — self-service, sempre exige a senha atual (ver
// users.changeOwnPassword). Rate-limit por usuário: não é brute-force de
// login, mas ainda dá pra tentar adivinhar a senha atual repetidamente.
router.patch('/api/me/password', requireSession, express.json(), async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'preencha a senha atual e a nova' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'a nova senha precisa ter pelo menos 8 caracteres' })
  }

  const okLimit = await checkLimit(`pwchange:${req.user.userId}`, 5, 15 * 60)
  if (!okLimit) {
    return res.status(429).json({ error: 'muitas tentativas — aguarde alguns minutos' })
  }

  const result = await users.changeOwnPassword(req.user.userId, currentPassword, newPassword)
  if (!result.ok) return res.status(400).json({ error: result.error })

  await auditLog.record(req.user, 'user.password_change', req.user.email, {})
  res.json({ ok: true })
})

// POST /api/me/avatar — multipart, campo "avatar". Substitui o arquivo
// anterior (apaga o antigo, best-effort — não bloqueia a resposta por isso).
router.post('/api/me/avatar', requireSession, (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'falha no upload' })
    next()
  })
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'nenhum arquivo enviado' })

  const previous = await users.findById(req.user.userId)
  const relativePath = `avatars/${req.file.filename}`
  const updated = await users.updateAvatarPath(req.user.userId, relativePath)

  if (previous?.avatar_path) {
    fs.unlink(path.join(MEDIA_DIR, previous.avatar_path), () => {})
  }

  await auditLog.record(req.user, 'user.avatar_update', req.user.email, {})
  res.json(toMe(updated))
})

// GET /api/my-access — apps (+ papel) do usuário logado, pra dashboard dele.
// Sem exigir superuser (diferente de /admin/api/access, que lista todo mundo).
router.get('/api/my-access', async (req, res) => {
  const current = await session.read(req)
  if (!current) return res.status(401).json({ error: 'não autenticado' })
  res.json(await appAccess.listForUser(current.userId))
})

module.exports = router
