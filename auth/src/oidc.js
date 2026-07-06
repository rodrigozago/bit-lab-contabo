const { Provider } = require('oidc-provider')
const { getOrCreateJwks } = require('./jwks')

const ISSUER = process.env.ISSUER || 'http://localhost:4000'
const JWKS_PATH = process.env.JWKS_PATH || '/app/data/jwks.json'

/**
 * Provider OIDC real (discovery, JWKS, /auth, /token, /userinfo etc.) — hoje
 * sem nenhum client registrado, porque nenhum app ainda consome o protocolo
 * (ponto-studio usa só o /verify + auth_request do nginx, ver src/routes/auth.js).
 *
 * Quando o primeiro app precisar de login OIDC de verdade (token/claims, não
 * só "está logado ou não"):
 *   1. Registrar o client em `clients` abaixo (ou carregar dinamicamente da
 *      tabela `apps`/nova tabela de clients).
 *   2. Implementar as rotas /interaction/:uid (GET) e /interaction/:uid/login
 *      (POST) que chamam oidc.interactionDetails / oidc.interactionFinished —
 *      é o único pedaço que falta; sem client registrado ninguém bate nelas.
 *
 * Adapter: por padrão o oidc-provider usa storage em memória (MemoryAdapter).
 * Serve bem pra uma instância única sem clients ativos ainda. Antes de colocar
 * o primeiro client OAuth real em produção (ou rodar mais de uma instância),
 * trocar por um adapter Redis (exemplo oficial em oidc-provider/example/adapters).
 */
const configuration = {
  clients: [],
  jwks: getOrCreateJwks(JWKS_PATH),
  cookies: {
    keys: [process.env.SESSION_SECRET || 'dev-secret-troque-em-producao'],
  },
  features: {
    devInteractions: { enabled: false },
  },
  async findAccount(_ctx, id) {
    return {
      accountId: id,
      async claims() {
        return { sub: id }
      },
    }
  },
}

const oidc = new Provider(ISSUER, configuration)

module.exports = oidc
