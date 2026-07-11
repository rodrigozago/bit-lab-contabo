import type { FastifyInstance } from 'fastify'
import { stmts, serializeSlot } from '../db.js'

export default async function timetableRoutes(app: FastifyInstance) {
  app.get('/api/timetable', async () => {
    const now = new Date().toISOString()
    const current = stmts.current.get(now, now)
    return {
      now,
      current: current ? serializeSlot(current) : null,
      upcoming: stmts.upcoming.all(now).map(serializeSlot),
      past: stmts.past.all(now).map(serializeSlot),
    }
  })
}
