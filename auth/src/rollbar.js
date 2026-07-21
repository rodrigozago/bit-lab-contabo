const Rollbar = require('rollbar')

/**
 * Rollbar do auth (rastreio de erros). Só liga com ROLLBAR_SERVER_TOKEN — sem
 * token vira no-op (dev e ambientes sem Rollbar não mandam nada). Token é
 * SECRETO (post_server_item), via env. Ver
 * ponto-studio/docs/SEGURANCA-PRE-LANCAMENTO.md item 6.
 */
let instance = null

const token = process.env.ROLLBAR_SERVER_TOKEN
if (token) {
  instance = new Rollbar({
    accessToken: token,
    environment: process.env.NODE_ENV || 'development',
    captureUncaught: true,
    captureUnhandledRejections: true,
    // não vaza segredo/cookie/senha nos payloads
    scrubFields: [
      'password', 'password2', 'authorization', 'cookie', 'set-cookie',
      'client_secret', 'SESSION_SECRET', 'bl_session', '_session', 'token',
    ],
  })
}

module.exports = { rollbar: instance }
