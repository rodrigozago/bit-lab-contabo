const express = require('express')
const cookieParser = require('cookie-parser')
const { migrate } = require('./db')
const { bootstrap } = require('./bootstrapAdmin')
const authRoutes = require('./routes/auth')
const adminRoutes = require('./routes/admin')
const interactionRoutes = require('./routes/interaction')
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
  app.use('/interaction', interactionRoutes)

  // provider OIDC real (discovery, jwks, /auth, /token, /userinfo...) — ver src/oidc.js
  app.use(oidc.callback())

  // error handler final — sem isso o Express usa o handler default, que não
  // loga err.error_description (onde o oidc-provider põe a razão específica de
  // erros como SessionNotFound, ex: "interaction session id cookie not found")
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(`[auth] erro em ${req.method} ${req.originalUrl}:`, {
      name: err.name,
      message: err.message,
      error: err.error,
      error_description: err.error_description,
      stack: err.stack,
    })
    if (res.headersSent) return next(err)
    const status = err.status || err.statusCode || 500
    res.status(status).type('html').send(
      `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Erro</title>
       <style>body{font-family:system-ui,sans-serif;background:#0f0f10;color:#eee;display:flex;
       align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px}
       a{color:#a98ee6}</style></head><body><div>
       <p>Algo deu errado no login (sessão expirada ou inválida).</p>
       <p>Feche esta aba e tente entrar de novo a partir do app.</p>
       </div></body></html>`
    )
  })

  app.listen(PORT, () => {
    console.log(`bit-lab-auth rodando em http://0.0.0.0:${PORT}`)
  })
}

main().catch((err) => {
  console.error('[auth] falha ao iniciar:', err)
  process.exit(1)
})
