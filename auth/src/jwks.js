const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

/**
 * Gera (uma vez) e persiste o par de chaves que o oidc-provider usa pra
 * assinar tokens. Sem isso, cada restart geraria chaves novas e invalidaria
 * qualquer token/sessão OIDC em curso. O arquivo fica num volume Docker.
 */
function getOrCreateJwks(filePath) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = privateKey.export({ format: 'jwk' })
  jwk.kid = crypto.randomUUID()
  jwk.use = 'sig'
  jwk.alg = 'RS256'

  const jwks = { keys: [jwk] }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(jwks, null, 2))
  return jwks
}

module.exports = { getOrCreateJwks }
