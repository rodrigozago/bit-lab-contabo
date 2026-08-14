const path = require('path')
const fs = require('fs')

// Padrão MEDIA_DIR do face-lab (face-lab/apps/api/src/config.ts) — disco
// local montado como volume Docker nomeado (ver docker-compose.yml), não
// S3/serviço externo.
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, '..', 'media')
const AVATAR_DIR = path.join(MEDIA_DIR, 'avatars')

fs.mkdirSync(AVATAR_DIR, { recursive: true })

// ISSUER já é a origem pública de auth.bit-lab.tech (ver oidc.js) — reaproveita
// pra montar a URL do avatar, que precisa ser absoluta pro claim `picture` do
// OIDC (outros apps recebem essa URL via userinfo, não conseguem resolver
// relativa). /media é servido como estático em src/index.js.
const PUBLIC_ORIGIN = process.env.ISSUER || 'http://localhost:4000'

function avatarUrl(avatarPath) {
  if (!avatarPath) return null
  return `${PUBLIC_ORIGIN}/media/${avatarPath}`
}

module.exports = { MEDIA_DIR, AVATAR_DIR, avatarUrl }
