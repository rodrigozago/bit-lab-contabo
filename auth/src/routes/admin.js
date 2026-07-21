const express = require('express')
const usersModel = require('../models/users')
const appsModel = require('../models/apps')
const appAccessModel = require('../models/appAccess')
const accessRequestsModel = require('../models/accessRequests')
const auditLog = require('../models/auditLog')
const { requireSession, requireAdmin } = require('../middleware')
const { renderAdmin } = require('../views/admin')

const router = express.Router()

router.use(requireSession, requireAdmin)
router.use(express.json())

function handlePgError(err, res) {
  if (err.code === '23505') return res.status(409).json({ error: 'já existe' })
  console.error('[admin]', err)
  return res.status(500).json({ error: 'erro interno' })
}

router.get('/', (req, res) => {
  res.type('html').send(renderAdmin({ email: req.user.email }))
})

// ── users ──────────────────────────────────────────────────────────────────
router.get('/api/users', async (req, res) => {
  res.json(await usersModel.list())
})

router.post('/api/users', async (req, res) => {
  const { email, password, isAdmin } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email e senha são obrigatórios' })
  try {
    const created = await usersModel.create({ email, password, isAdmin: !!isAdmin })
    await auditLog.record(req.user, 'user.create', created.email, { isAdmin: !!isAdmin })
    res.json(created)
  } catch (err) {
    handlePgError(err, res)
  }
})

router.post('/api/users/:id/reset-password', async (req, res) => {
  const { password } = req.body
  if (!password) return res.status(400).json({ error: 'senha é obrigatória' })
  await usersModel.resetPassword(req.params.id, password)
  await auditLog.record(req.user, 'user.reset_password', req.params.id)
  res.json({ ok: true })
})

router.delete('/api/users/:id', async (req, res) => {
  await usersModel.remove(req.params.id)
  await auditLog.record(req.user, 'user.delete', req.params.id)
  res.json({ ok: true })
})

// ── apps ───────────────────────────────────────────────────────────────────
router.get('/api/apps', async (req, res) => {
  res.json(await appsModel.list())
})

router.post('/api/apps', async (req, res) => {
  const { slug, name } = req.body
  if (!slug || !name) return res.status(400).json({ error: 'slug e nome são obrigatórios' })
  try {
    res.json(await appsModel.create({ slug, name }))
  } catch (err) {
    handlePgError(err, res)
  }
})

router.delete('/api/apps/:id', async (req, res) => {
  await appsModel.remove(req.params.id)
  res.json({ ok: true })
})

// ── access ─────────────────────────────────────────────────────────────────
router.get('/api/access', async (req, res) => {
  res.json(await appAccessModel.list())
})

router.post('/api/access', async (req, res) => {
  const { userId, appId } = req.body
  if (!userId || !appId) return res.status(400).json({ error: 'userId e appId são obrigatórios' })
  await appAccessModel.grant(userId, appId)
  await auditLog.record(req.user, 'access.grant', userId, { appId })
  res.json({ ok: true })
})

router.delete('/api/access/:userId/:appId', async (req, res) => {
  await appAccessModel.revoke(req.params.userId, req.params.appId)
  await auditLog.record(req.user, 'access.revoke', req.params.userId, { appId: req.params.appId })
  res.json({ ok: true })
})

// ── fila de solicitações de acesso ──────────────────────────────────────────
router.get('/api/access-requests', async (req, res) => {
  res.json(await accessRequestsModel.listPending())
})

router.post('/api/access-requests/:id/approve', async (req, res) => {
  const request = await accessRequestsModel.approve(req.params.id, req.user.userId)
  if (!request) return res.status(404).json({ error: 'solicitação não encontrada ou já decidida' })
  await auditLog.record(req.user, 'access_request.approve', req.params.id)
  res.json({ ok: true })
})

router.post('/api/access-requests/:id/reject', async (req, res) => {
  const request = await accessRequestsModel.reject(req.params.id, req.user.userId)
  if (!request) return res.status(404).json({ error: 'solicitação não encontrada ou já decidida' })
  await auditLog.record(req.user, 'access_request.reject', req.params.id)
  res.json({ ok: true })
})

module.exports = router
