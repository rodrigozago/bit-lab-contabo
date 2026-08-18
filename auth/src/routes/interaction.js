const express = require('express')
const oidc = require('../oidc')
const users = require('../models/users')
const apps = require('../models/apps')
const appAccess = require('../models/appAccess')
const emailVerificationTokens = require('../models/emailVerificationTokens')
const legalAcceptances = require('../models/legalAcceptances')
const mailClient = require('../mailClient')
const session = require('../session')
const { checkLimit } = require('../rateLimit')
const { renderLogin, renderVerifyPending } = require('../views/login')
const { renderAppTerms } = require('../views/legal')

const router = express.Router()

// "Criar conta" na tela de login do OIDC só aparece se o app sendo acessado
// (client_id === slug) tiver self-signup ligado — não é mais uma flag global.
async function loginPage(uid, appSlug, extra = {}) {
  const app = appSlug && (await apps.findBySlug(appSlug))
  const signupHref = app && app.allow_self_signup
    // depois do signup o usuário volta pra interação e o GET completa o login sozinho
    ? `/signup?app=${encodeURIComponent(appSlug)}&redirect=${encodeURIComponent(`/interaction/${uid}`)}`
    : undefined
  return renderLogin({
    action: `/interaction/${uid}/login`,
    signupHref,
    ...extra,
  })
}

// Sem fila de solicitação pendente: conta sem acesso é só negada. Acesso só
// sai de convite do superuser (link/token) ou self-signup ligado pro app.
async function finishWithAccessDenied(req, res) {
  return oidc.interactionFinished(
    req,
    res,
    { error: 'access_denied', error_description: 'Conta sem acesso a este app — peça um link de convite ao superuser.' },
    { mergeWithLastSubmission: false }
  )
}

router.get('/:uid', async (req, res, next) => {
  try {
    const details = await oidc.interactionDetails(req, res)
    const { prompt, params, uid } = details

    if (prompt.name === 'login') {
      // SSO: bl_session válida (setada por qualquer app *.bit-lab.tech) pula a tela de login
      const current = await session.read(req)
      if (current) {
        if (!(await appAccess.hasAccess(current.userId, params.client_id))) {
          return await finishWithAccessDenied(req, res)
        }
        return await oidc.interactionFinished(
          req,
          res,
          { login: { accountId: current.userId } },
          { mergeWithLastSubmission: false }
        )
      }
      return res.type('html').send(await loginPage(uid, params.client_id))
    }

    if (prompt.name === 'consent') {
      // todos os clients são apps nossos — auto-consent, mas respeitando app_access
      const accountId = details.session.accountId
      if (!(await appAccess.hasAccess(accountId, params.client_id))) {
        return await finishWithAccessDenied(req, res)
      }

      // Gate 1: e-mail precisa estar confirmado (self-signup só libera depois
      // de clicar no link — convite/admin já nascem verificados, ver
      // db/schema.sql). Renderiza uma tela própria em vez de abortar a
      // interação: o usuário pode reenviar o e-mail e tentar de novo depois.
      const account = await users.findById(accountId)
      if (!account.email_verified) {
        return res.type('html').send(renderVerifyPending({ uid }))
      }

      // Gate 2: termo PRÓPRIO do app (além do termo global do cadastro) —
      // só se o app tiver terms_version configurado (ver apps.terms_version).
      const app = await apps.findBySlug(params.client_id)
      if (app?.terms_version) {
        const accepted = await legalAcceptances.hasAccepted(accountId, app.slug, app.terms_version)
        if (!accepted) {
          return res.type('html').send(renderAppTerms({ uid, appName: app.name, termsUrl: app.terms_url || '/legal/termos' }))
        }
      }

      let grant = details.grantId ? await oidc.Grant.find(details.grantId) : undefined
      if (!grant) grant = new oidc.Grant({ accountId, clientId: params.client_id })

      if (prompt.details.missingOIDCScope) {
        grant.addOIDCScope(prompt.details.missingOIDCScope.join(' '))
      }
      if (prompt.details.missingOIDCClaims) {
        grant.addOIDCClaims(prompt.details.missingOIDCClaims)
      }
      if (prompt.details.missingResourceScopes) {
        for (const [indicator, scopes] of Object.entries(prompt.details.missingResourceScopes)) {
          grant.addResourceScope(indicator, scopes.join(' '))
        }
      }

      const grantId = await grant.save()
      return await oidc.interactionFinished(req, res, { consent: { grantId } }, { mergeWithLastSubmission: true })
    }

    return next(new Error(`prompt de interação desconhecido: ${prompt.name}`))
  } catch (err) {
    next(err)
  }
})

router.post('/:uid/login', express.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    const details = await oidc.interactionDetails(req, res)
    if (details.prompt.name !== 'login') {
      return next(new Error('interação não está aguardando login'))
    }

    const { uid, params } = details
    const { email, password } = req.body
    const ip = req.ip || 'unknown'

    // dois limites (por conta + por IP puro) — mesmo motivo do POST /login em
    // routes/auth.js (item 17 do SEGURANCA-PRE-LANCAMENTO.md)
    const okPerAccount = await checkLimit(`login:${ip}:${(email || '').toLowerCase()}`, 10, 15 * 60)
    const okPerIp = await checkLimit(`login-ip:${ip}`, 50, 15 * 60)
    if (!okPerAccount || !okPerIp) {
      return res.status(429).type('html').send(await loginPage(uid, params.client_id, { error: 'Muitas tentativas — tente de novo em alguns minutos.' }))
    }

    const user = email && (await users.findByEmail(email))
    if (!user || !users.verifyPassword(user, password || '')) {
      return res.status(401).type('html').send(await loginPage(uid, params.client_id, { error: 'E-mail ou senha incorretos.' }))
    }

    if (!(await appAccess.hasAccess(user.id, params.client_id))) {
      return res.status(403).type('html').send(await loginPage(uid, params.client_id, { error: 'Sua conta não tem acesso a este app — peça um link de convite ao superuser.' }))
    }

    // também cria a bl_session compartilhada: logar aqui = logado nos apps do gate nginx
    await session.create(res, user)

    return await oidc.interactionFinished(req, res, { login: { accountId: user.id } }, { mergeWithLastSubmission: false })
  } catch (err) {
    next(err)
  }
})

// POST /interaction/:uid/resend-verification — chamado da tela de "confirme
// seu e-mail" (gate 1 do consent, acima). Não termina a interação — só
// reenvia e mostra a mesma tela com uma confirmação.
router.post('/:uid/resend-verification', async (req, res, next) => {
  try {
    const details = await oidc.interactionDetails(req, res)
    const { uid } = details
    const accountId = details.session?.accountId
    if (!accountId) return next(new Error('interação sem sessão de conta'))

    const okLimit = await checkLimit(`verify-resend:${accountId}`, 3, 15 * 60)
    if (okLimit) {
      const user = await users.findById(accountId)
      if (user && !user.email_verified) {
        const verifyToken = await emailVerificationTokens.create(accountId)
        mailClient.sendEmailVerification({
          to: user.email,
          url: `https://auth.bit-lab.tech/verify-email?token=${verifyToken.raw}`,
        })
      }
    }

    return res.type('html').send(renderVerifyPending({ uid, resent: true }))
  } catch (err) {
    next(err)
  }
})

// POST /interaction/:uid/terms — aceite do termo PRÓPRIO do app (gate 2 do
// consent, acima). Grava o aceite e deixa o próximo GET /interaction/:uid
// (a interação continua aberta) passar pro auto-consent normalmente.
router.post('/:uid/terms', express.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    const details = await oidc.interactionDetails(req, res)
    const { uid, params } = details
    const accountId = details.session?.accountId
    if (!accountId) return next(new Error('interação sem sessão de conta'))
    if (!req.body.accept) {
      const app = await apps.findBySlug(params.client_id)
      return res.type('html').send(renderAppTerms({ uid, appName: app.name, termsUrl: app.terms_url || '/legal/termos' }))
    }

    const app = await apps.findBySlug(params.client_id)
    await legalAcceptances.record(accountId, app.slug, app.terms_version)

    res.redirect(`/interaction/${uid}`)
  } catch (err) {
    next(err)
  }
})

module.exports = router
