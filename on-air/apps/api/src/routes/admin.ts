import type { FastifyInstance, FastifyRequest } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { v4 as uuid } from 'uuid'
import db, { MEDIA_DIR, stmts, serializeSlot } from '../db.js'
import { spWallToUtcIso } from '../time.js'

// Sem código de auth aqui de propósito: /api/admin/* só é alcançável em produção
// atravessando o auth_request do nginx da VPS (mesmo modelo do ponto-studio).
// O X-User-Email injetado pela borda vira trilha de auditoria nos logs.

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

interface ParsedForm {
  fields: Record<string, string>
  photo: { buf: Buffer; ext: string } | null
}

async function readForm(req: FastifyRequest): Promise<ParsedForm> {
  const fields: Record<string, string> = {}
  let photo: ParsedForm['photo'] = null
  for await (const part of req.parts()) {
    if (part.type === 'file') {
      // input file vazio chega como parte sem filename — ignora
      if (part.fieldname === 'photo' && part.filename) {
        const ext = EXT_BY_MIME[part.mimetype]
        if (!ext) throw Object.assign(new Error('Foto deve ser JPEG, PNG ou WebP'), { statusCode: 400 })
        photo = { buf: await part.toBuffer(), ext }
      } else {
        part.file.resume()
      }
    } else {
      fields[part.fieldname] = String(part.value)
    }
  }
  return { fields, photo }
}

function parseSlotFields(fields: Record<string, string>) {
  const artist = fields['artist']?.trim()
  const genre = fields['genre']?.trim()
  const startsLocal = fields['starts_at_local']
  const endsLocal = fields['ends_at_local']
  if (!artist || !genre || !startsLocal || !endsLocal) {
    throw Object.assign(new Error('artist, genre, starts_at_local e ends_at_local são obrigatórios'), {
      statusCode: 400,
    })
  }
  const starts_at = spWallToUtcIso(startsLocal)
  const ends_at = spWallToUtcIso(endsLocal)
  if (ends_at <= starts_at) {
    throw Object.assign(new Error('Horário final precisa ser depois do inicial'), { statusCode: 400 })
  }
  return { artist, genre, starts_at, ends_at }
}

function assertNoOverlap(starts_at: string, ends_at: string, ignoreId: number) {
  const row = stmts.overlapping.get(ends_at, starts_at, ignoreId)
  if (row && row.n > 0) {
    throw Object.assign(new Error('Horário sobrepõe outro slot — só um artista toca por vez'), {
      statusCode: 409,
    })
  }
}

function savePhoto(photo: NonNullable<ParsedForm['photo']>): string {
  const file = `slot-${uuid()}.${photo.ext}`
  fs.writeFileSync(path.join(MEDIA_DIR, file), photo.buf)
  return file
}

function unlinkPhoto(file: string | null) {
  if (!file) return
  fs.rmSync(path.join(MEDIA_DIR, file), { force: true })
}

export default async function adminRoutes(app: FastifyInstance) {
  app.get('/api/admin/slots', async () => ({
    slots: stmts.all.all().map(serializeSlot),
  }))

  app.post('/api/admin/slots', async (req, reply) => {
    const { fields, photo } = await readForm(req)
    const slot = parseSlotFields(fields)
    assertNoOverlap(slot.starts_at, slot.ends_at, -1)
    const image = photo ? savePhoto(photo) : null
    const info = stmts.insert.run(slot.artist, slot.genre, image, slot.starts_at, slot.ends_at)
    req.log.info({ user: req.headers['x-user-email'], slot: info.lastInsertRowid }, 'slot criado')
    const row = stmts.byId.get(Number(info.lastInsertRowid))
    return reply.code(201).send(serializeSlot(row!))
  })

  app.put('/api/admin/slots/:id', async (req) => {
    const id = Number((req.params as { id: string }).id)
    const existing = stmts.byId.get(id)
    if (!existing) throw Object.assign(new Error('Slot não encontrado'), { statusCode: 404 })
    const { fields, photo } = await readForm(req)
    const slot = parseSlotFields(fields)
    assertNoOverlap(slot.starts_at, slot.ends_at, id)
    let image = existing.image_file
    if (photo) {
      image = savePhoto(photo)
      unlinkPhoto(existing.image_file)
    }
    stmts.update.run(slot.artist, slot.genre, image, slot.starts_at, slot.ends_at, id)
    req.log.info({ user: req.headers['x-user-email'], slot: id }, 'slot atualizado')
    return serializeSlot(stmts.byId.get(id)!)
  })

  app.delete('/api/admin/slots/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    const existing = stmts.byId.get(id)
    if (!existing) throw Object.assign(new Error('Slot não encontrado'), { statusCode: 404 })
    db.transaction(() => {
      stmts.remove.run(id)
    })()
    unlinkPhoto(existing.image_file)
    req.log.info({ user: req.headers['x-user-email'], slot: id }, 'slot removido')
    return reply.code(204).send()
  })
}
