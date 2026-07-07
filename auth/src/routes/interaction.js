const express = require('express')
const oidc = require('../oidc')
const users = require('../models/users')
const appAccess = require('../models/appAccess')
const session = require('../session')
const { checkLimit } = require('../rateLimit')
const { renderLogin } = require('../views/login')

const router = express.Router()

const SIGNUP_ENABLED = () => process.env.ALLOW_SELF_SIGNUP === 'true'

function loginPage(uid, extra = {}) {
  return renderLogin({
    action: `/interaction/${uid}/login`,
    // depois do signup o usuário volta pra interação e o GET completa o login sozinho
    signupHref: SIGNUP_ENABLED() ? `/signup?redirect=${encodeURIComponent(`/interaction/${uid}`)}` : undefined,
    ...extra,
  })
}

async function finishWithAccessDenied(req, res) {
  return oidc.interactionFinished(
    req,
    res,
    { error: 'access_denied', error_description: 'Conta sem acesso a este app — fale com o admin do bit-lab-auth.' },
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
      return res.type('html').send(loginPage(uid))
    }

    if (prompt.name === 'consent') {
      // todos os clients são apps nossos — auto-consent, mas respeitando app_access
      const accountId = details.session.accountId
      if (!(await appAccess.hasAccess(accountId, params.client_id))) {
        return await finishWithAccessDenied(req, res)
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

    const okRate = await checkLimit(`login:${ip}:${(email || '').toLowerCase()}`, 10, 15 * 60)
    if (!okRate) {
      return res.status(429).type('html').send(loginPage(uid, { error: 'Muitas tentativas — tente de novo em alguns minutos.' }))
    }

    const user = email && (await users.findByEmail(email))
    if (!user || !users.verifyPassword(user, password || '')) {
      return res.status(401).type('html').send(loginPage(uid, { error: 'E-mail ou senha incorretos.' }))
    }

    if (!(await appAccess.hasAccess(user.id, params.client_id))) {
      return res.status(403).type('html').send(loginPage(uid, { error: 'Sua conta não tem acesso a este app — fale com o admin.' }))
    }

    // também cria a bl_session compartilhada: logar aqui = logado nos apps do gate nginx
    await session.create(res, user)

    return await oidc.interactionFinished(req, res, { login: { accountId: user.id } }, { mergeWithLastSubmission: false })
  } catch (err) {
    next(err)
  }
})

module.exports = router
