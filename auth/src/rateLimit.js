const redis = require('./redisClient')

/**
 * Rate limit simples por chave (ex: IP+email) — máximo `limit` tentativas
 * a cada `windowSeconds`. Usado só no POST /login pra frear brute-force.
 */
async function checkLimit(key, limit, windowSeconds) {
  const redisKey = `ratelimit:${key}`
  const count = await redis.incr(redisKey)
  if (count === 1) await redis.expire(redisKey, windowSeconds)
  return count <= limit
}

module.exports = { checkLimit }
