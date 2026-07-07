const users = require('./models/users')
const apps = require('./models/apps')
const appAccess = require('./models/appAccess')

const SEED_APPS = [
  { slug: 'ponto-studio', name: 'Ponto Studio' },
  { slug: 'face-lab', name: 'Face Lab' },
]

/**
 * No primeiro boot (tabela users vazia): cria o admin inicial a partir do
 * .env e já concede acesso aos apps semeados — pra logar e usar sem precisar
 * clicar em nada no painel antes.
 * Idempotente: se já existir algum usuário, não faz nada com INITIAL_ADMIN_*.
 */
async function bootstrap() {
  const seededApps = []
  for (const app of SEED_APPS) {
    seededApps.push(await apps.ensure(app))
  }

  const existing = await users.count()
  if (existing > 0) return

  const email = process.env.INITIAL_ADMIN_EMAIL
  const password = process.env.INITIAL_ADMIN_PASSWORD
  if (!email || !password) {
    console.warn(
      '[bootstrap] Nenhum usuário existe e INITIAL_ADMIN_EMAIL/INITIAL_ADMIN_PASSWORD não foram definidos — ' +
      'ninguém consegue logar ainda. Defina essas variáveis no .env e reinicie.'
    )
    return
  }

  const admin = await users.create({ email, password, isAdmin: true })
  for (const app of seededApps) {
    await appAccess.grant(admin.id, app.id)
  }
  console.log(`[bootstrap] Admin inicial criado: ${admin.email}`)
}

module.exports = { bootstrap }
