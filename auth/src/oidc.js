const { Provider } = require('oidc-provider')
const { getOrCreateJwks } = require('./jwks')
const RedisAdapter = require('./oidcRedisAdapter')
const users = require('./models/users')

const ISSUER = process.env.ISSUER || 'http://localhost:4000'
const JWKS_PATH = process.env.JWKS_PATH || '/app/data/jwks.json'
const IS_PROD = process.env.NODE_ENV === 'production'

/**
 * Provider OIDC real (discovery, JWKS, /auth, /token, /userinfo etc.).
 *
 * Primeiro client registrado: face-lab (BFF confidencial, code + PKCE).
 * As rotas /interaction/:uid vivem em src/routes/interaction.js — reutilizam a
 * sessão bl_session do Redis, então quem já logou em qualquer app *.bit-lab.tech
 * passa pelo /auth sem ver tela de login (SSO de verdade).
 *
 * Convenção: client_id OIDC === slug na tabela `apps` — o consent verifica
 * app_access igual o /verify do gate nginx faz, um modelo de acesso só.
 */

const clients = []

if (process.env.FACE_LAB_OIDC_SECRET) {
  clients.push({
    client_id: 'face-lab',
    client_secret: process.env.FACE_LAB_OIDC_SECRET,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    redirect_uris: [
      'https://face.bit-lab.tech/api/auth/callback',
      ...(IS_PROD ? [] : ['http://localhost:4003/api/auth/callback']),
    ],
    token_endpoint_auth_method: 'client_secret_basic',
  })
} else {
  console.warn('[oidc] FACE_LAB_OIDC_SECRET não definido — client face-lab NÃO registrado.')
}

if (process.env.PONTO_STUDIO_OIDC_SECRET) {
  clients.push({
    client_id: 'ponto-studio',
    client_secret: process.env.PONTO_STUDIO_OIDC_SECRET,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    redirect_uris: [
      'https://ponto.bit-lab.tech/api/auth/callback',
      ...(IS_PROD ? [] : ['http://localhost:4001/api/auth/callback']),
    ],
    token_endpoint_auth_method: 'client_secret_basic',
  })
} else {
  console.warn('[oidc] PONTO_STUDIO_OIDC_SECRET não definido — client ponto-studio NÃO registrado.')
}

const configuration = {
  adapter: RedisAdapter,
  clients,
  jwks: getOrCreateJwks(JWKS_PATH),
  cookies: {
    keys: [process.env.SESSION_SECRET || 'dev-secret-troque-em-producao'],
  },
  pkce: {
    required: () => true,
  },
  claims: {
    openid: ['sub'],
    email: ['email', 'email_verified', 'is_admin'],
  },
  interactions: {
    url: (_ctx, interaction) => `/interaction/${interaction.uid}`,
  },
  features: {
    devInteractions: { enabled: false },
  },
  async findAccount(_ctx, id) {
    const user = await users.findById(id)
    if (!user) return undefined
    return {
      accountId: id,
      async claims() {
        return { sub: id, email: user.email, email_verified: true, is_admin: user.is_admin }
      },
    }
  },
}

const oidc = new Provider(ISSUER, configuration)
oidc.proxy = true // atrás do nginx — confia no X-Forwarded-Proto pro issuer https

module.exports = oidc
