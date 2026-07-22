const session = require('./session')
const users = require('./models/users')

async function requireSession(req, res, next) {
  const current = await session.read(req)
  if (!current) {
    if (req.accepts('html')) return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl))
    return res.status(401).json({ error: 'não autenticado' })
  }
  req.user = current
  next()
}

// Confere is_superuser direto no banco (não confia na sessão cacheada) —
// assim, revogar superuser de alguém tem efeito imediato, sem esperar a
// sessão expirar.
async function requireSuperuser(req, res, next) {
  const fresh = await users.findById(req.user.userId)
  if (!fresh || !fresh.is_superuser) return res.status(403).json({ error: 'apenas superuser' })
  next()
}

module.exports = { requireSession, requireSuperuser }
