const crypto = require('crypto')
const redis = require('./redisClient')

const COOKIE_NAME = 'bl_session'
const TTL_SECONDS = 60 * 60 * 24 * 7 // 7 dias
const KEY_PREFIX = 'session:'

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined // vazio/undefined = cookie host-only (bom pra dev local)

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: COOKIE_DOMAIN,
    maxAge: TTL_SECONDS * 1000,
    path: '/',
  }
}

async function create(res, user) {
  const token = crypto.randomBytes(32).toString('hex')
  await redis.set(
    KEY_PREFIX + token,
    JSON.stringify({ userId: user.id, email: user.email, isAdmin: user.is_admin }),
    'EX',
    TTL_SECONDS
  )
  res.cookie(COOKIE_NAME, token, cookieOptions())
  return token
}

async function read(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME]
  if (!token) return null
  const raw = await redis.get(KEY_PREFIX + token)
  if (!raw) return null
  return JSON.parse(raw)
}

async function destroy(req, res) {
  const token = req.cookies && req.cookies[COOKIE_NAME]
  if (token) await redis.del(KEY_PREFIX + token)
  res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN, path: '/' })
}

module.exports = { create, read, destroy, COOKIE_NAME }
