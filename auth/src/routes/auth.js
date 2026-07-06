const express = require('express')
const users = require('../models/users')
const appAccess = require('../models/appAccess')
const session = require('../session')
const { checkLimit } = require('../rateLimit')
const { renderLogin } = require('../views/login')

const router = express.Router()

function safeRedirectPath(raw) {
  // Só permite redirect pra URLs *.bit-lab.tech (https) — evita open-redirect.
  if (!raw) return null
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
