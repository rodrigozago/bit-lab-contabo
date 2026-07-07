const express = require('express')
const users = require('../models/users')
const apps = require('../models/apps')
const appAccess = require('../models/appAccess')
const session = require('../session')
const { checkLimit } = require('../rateLimit')
const { renderLogin, renderSignup } = require('../views/login')

const router = express.Router()

const SIGNUP_ENABLED = () => process.env.ALLOW_SELF_SIGNUP === 'true'
// apps auto-concedidos a quem cria conta sozinho (client_id/slug, separados por vírgula)
const SELF_SIGNUP_APPS = () => (process.env.SELF_SIGNUP_GRANT_APPS || 'face-lab').split(',').map((s) => s.trim()).filter(Boolean)

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

function signupHrefFor(redirect) {
  if (!SIGNUP_ENABLED()) return undefined
  return `/signup${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`
}

router.get('/login', (req, res) => {
  res.type('html').send(renderLogin({ redirect: req.query.redirect, signupHref: signupHrefFor(req.query.redirect) }))
})

router.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
  const { email, password, redirect } = req.body
  const ip = req.ip || 'unknown'

  const okRate = await checkLimit(`login:${ip}:${(email || '').toLowerCase()}`, 10, 15 * 60)
  if (!okRate) {
    return res.status(429).type('html').send(renderLogin({
      error: 'Muitas tentativas — tente de novo em alguns minutos.', redirect,
    }))
  }

  const user = email && (await users.findByEmail(email))
  if (!user || !users.verifyPassword(user, password || '')) {
    return res.status(401).type('html').send(renderLogin({ error: 'E-mail ou senha incorretos.', redirect }))
  }

  await session.create(res, user)
  const target = safeRedirectPath(redirect) || '/admin'
  res.redirect(target)
})

router.post('/logout', async (req, res) => {
  await session.destroy(req, res)
  res.redirect('/login')
})

// Signup self-service (atrás de ALLOW_SELF_SIGNUP) — criado pro face-lab: guest
// cria a própria conta e já sai com acesso concedido aos apps de SELF_SIGNUP_GRANT_APPS.
router.get('/signup', (req, res) => {
  if (!SIGNUP_ENABLED()) return res.status(404).end()
  res.type('html').send(renderSignup({ redirect: req.query.redirect }))
})

router.post('/signup', express.urlencoded({ extended: false }), async (req, res) => {
  if (!SIGNUP_ENABLED()) return res.status(404).end()

  const { email, password, password2, redirect } = req.body
  const ip = req.ip || 'unknown'
  const fail = (status, error) => res.status(status).type('html').send(renderSignup({ error, redirect }))

  const okRate = await checkLimit(`signup:${ip}`, 5, 60 * 60)
  if (!okRate) return fail(429, 'Muitas contas criadas — tente de novo mais tarde.')

  const cleanEmail = (email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return fail(400, 'E-mail inválido.')
  if (!password || password.length < 8) return fail(400, 'A senha precisa ter pelo menos 8 caracteres.')
  if (password !== password2) return fail(400, 'As senhas não conferem.')
  if (await users.findByEmail(cleanEmail)) return fail(409, 'Já existe uma conta com esse e-mail.')

  const user = await users.create({ email: cleanEmail, password })
  for (const slug of SELF_SIGNUP_APPS()) {
    const app = await apps.findBySlug(slug)
    if (app) await appAccess.grant(user.id, app.id)
  }

  await session.create(res, user)
  res.redirect(safeRedirectPath(redirect) || '/')
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

module.exports = router
