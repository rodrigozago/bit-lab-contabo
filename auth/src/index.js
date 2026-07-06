const express = require('express')
const cookieParser = require('cookie-parser')
const { migrate } = require('./db')
const { bootstrap } = require('./bootstrapAdmin')
const authRoutes = require('./routes/auth')
const adminRoutes = require('./routes/admin')
const oidc = require('./oidc')

const PORT = Number(process.env.PORT || 4000)

async function main() {
  await migrate()
  await bootstrap()

  const app = express()
  app.set('trust proxy', true) // atrás do nginx da VPS — pra req.ip/rate-limit funcionarem certo

  app.use(cookieParser())

  app.get('/health', (req, res) => res.json({ ok: true, service: 'bit-lab-auth' }))

  // rotas próprias primeiro — não colidem com as rotas reservadas do oidc-provider
  app.use('/', authRoutes)
  app.use('/admin', adminRoutes)

  // provider OIDC real (discovery, jwks, /auth, /token, /userinfo...) — ver src/oidc.js
  app.use(oidc.callback())

  app.listen(PORT, () => {
    console.log(`bit-lab-auth rodando em http://0.0.0.0:${PORT}`)
  })
}

main().catch((err) => {
  console.error('[auth] falha ao iniciar:', err)
  process.exit(1)
})
