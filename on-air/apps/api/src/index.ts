import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { MEDIA_DIR } from './db.js'
import timetableRoutes from './routes/timetable.js'
import adminRoutes from './routes/admin.js'

const app = Fastify({ logger: true })

await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

// Fotos dos artistas — nomes são UUID únicos por upload, então cache imutável
await app.register(fastifyStatic, {
  root: MEDIA_DIR,
  prefix: '/api/media/',
  decorateReply: false,
  maxAge: '365d',
  immutable: true,
})

app.get('/api/health', async () => ({ ok: true }))

await app.register(timetableRoutes)
await app.register(adminRoutes)

const port = Number(process.env['PORT'] ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
