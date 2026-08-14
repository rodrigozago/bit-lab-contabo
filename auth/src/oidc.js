const { Provider } = require('oidc-provider')
const { getOrCreateJwks } = require('./jwks')
const RedisAdapter = require('./oidcRedisAdapter')
const users = require('./models/users')
const { avatarUrl } = require('./media')

const ISSUER = process.env.ISSUER || 'http://localhost:4000'
const JWKS_PATH = process.env.JWKS_PATH || '/app/data/jwks.json'
const IS_PROD = process.env.NODE_ENV === 'production'

// Chave que assina os cookies do oidc-provider. Em produção, subir sem uma
// chave forte e própria = assinar com uma string PÚBLICA do código-fonte, que
// permite forjar sessão do provider (comprometimento total do SSO). Por isso
// aborta o boot em vez de cair no default. Ver docs/SEGURANCA-PRE-LANCAMENTO.md
// item 2 (no ponto-studio) — mesma classe de problema.
const DEV_SESSION_SECRET = 'dev-secret-troque-em-producao'
const SESSION_SECRET = process.env.SESSION_SECRET || DEV_SESSION_SECRET
if (IS_PROD && (!process.env.SESSION_SECRET || SESSION_SECRET === DEV_SESSION_SECRET)) {
  throw new Error(
    '[oidc] SESSION_SECRET ausente ou igual ao default de dev em produção — ' +
    'gere um valor forte (openssl rand -hex 32) e defina no .env antes de subir.'
  )
}

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

if (process.env.BORDADO_DIGITAL_OIDC_SECRET) {
  clients.push({
    client_id: 'bordado-digital',
    client_secret: process.env.BORDADO_DIGITAL_OIDC_SECRET,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    redirect_uris: [
      'https://bordado.digital/api/auth/callback',
      ...(IS_PROD ? [] : ['http://localhost:4001/api/auth/callback']),
    ],
    token_endpoint_auth_method: 'client_secret_basic',
  })
} else {
  console.warn('[oidc] BORDADO_DIGITAL_OIDC_SECRET não definido — client bordado-digital NÃO registrado.')
}

if (process.env.SENTINELA_OIDC_SECRET) {
  clients.push({
    client_id: 'sentinela',
    client_secret: process.env.SENTINELA_OIDC_SECRET,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    redirect_uris: [
      'https://sentinela.bit-lab.tech/api/auth/callback',
      ...(IS_PROD ? [] : ['http://localhost:4005/api/auth/callback']),
    ],
    token_endpoint_auth_method: 'client_secret_basic',
  })
} else {
  console.warn('[oidc] SENTINELA_OIDC_SECRET não definido — client sentinela NÃO registrado.')
}

if (process.env.STUDIO_OIDC_SECRET) {
  clients.push({
    client_id: 'studio',
    client_secret: process.env.STUDIO_OIDC_SECRET,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    redirect_uris: [
      'https://studio.bit-lab.tech/auth/callback',
      ...(IS_PROD ? [] : ['http://localhost:3008/auth/callback']),
    ],
    token_endpoint_auth_method: 'client_secret_basic',
  })
} else {
  console.warn('[oidc] STUDIO_OIDC_SECRET não definido — client studio NÃO registrado.')
}

const configuration = {
  adapter: RedisAdapter,
  clients,
  jwks: getOrCreateJwks(JWKS_PATH),
  cookies: {
    // array pra permitir rotação futura sem derrubar sessões (a 1ª assina, as
    // demais só validam). SESSION_SECRET é garantido forte em prod pelo guard acima.
    keys: [SESSION_SECRET],
  },
  pkce: {
    required: () => true,
  },
  claims: {
    openid: ['sub'],
    email: ['email', 'email_verified', 'is_admin'],
    // Scope novo — nome/foto de perfil (self-service, ver routes/auth.js).
    // Nenhum client precisa ser reconfigurado aqui pra usar: é só incluir
    // "profile" no `scope` do authorizationUrl de cada app consumidor.
    // Claim names padrão OIDC (name/picture), não os nomes de coluna do banco.
    profile: ['name', 'picture'],
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
        // ATENÇÃO: email_verified é sempre `true` por design — o signup NÃO
        // faz verificação de e-mail por link. Nenhum RP deve confiar nesta
        // claim como garantia de que o e-mail foi confirmado. Se um dia
        // precisar dessa garantia, implementar verificação no signup e
        // refletir o valor real aqui. Ver
        // ponto-studio/docs/SEGURANCA-PRE-LANCAMENTO.md item 10.
        //
        // Claim continua se chamando `is_admin` no wire (não renomeado pra
        // is_superuser) de propósito — é o que ponto-studio já lê no
        // finishAuth() hoje; renomear quebraria sem redeploy coordenado.
        return {
          sub: id,
          email: user.email,
          email_verified: true,
          is_admin: user.is_superuser,
          name: user.name || undefined,
          picture: avatarUrl(user.avatar_path) || undefined,
        }
      },
    }
  },
}

const oidc = new Provider(ISSUER, configuration)
oidc.proxy = true // atrás do nginx — confia no X-Forwarded-Proto pro issuer https

module.exports = oidc
