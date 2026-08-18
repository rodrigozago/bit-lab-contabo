const users = require('./models/users')
const apps = require('./models/apps')
const appAccess = require('./models/appAccess')
const { BORDADO_DIGITAL_TERMS_VERSION } = require('./legal')

const SEED_APPS = [
  { slug: 'bordado-digital', name: 'Bordado Digital' },
  { slug: 'face-lab', name: 'Face Lab' },
  { slug: 'on-air', name: 'On Air' },
  { slug: 'sentinela', name: 'Sentinela' },
  { slug: 'studio', name: 'Studio' },
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

  // Termo próprio do bordado-digital (decisão do alpha) — só seta se ainda
  // não foi configurado, pra um superuser poder trocar depois pelo painel
  // sem o bootstrap sobrescrever a cada boot (mesmo cuidado de apps.ensure()
  // com allow_self_signup).
  const bordadoDigital = seededApps.find((app) => app.slug === 'bordado-digital')
  if (bordadoDigital && !bordadoDigital.terms_version) {
    await apps.setTerms(bordadoDigital.id, {
      termsVersion: BORDADO_DIGITAL_TERMS_VERSION,
      termsUrl: '/legal/termos',
    })
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

  const admin = await users.create({ email, password, isSuperuser: true })
  for (const app of seededApps) {
    await appAccess.grant(admin.id, app.id)
  }
  console.log(`[bootstrap] Admin inicial criado: ${admin.email}`)
}

module.exports = { bootstrap }
