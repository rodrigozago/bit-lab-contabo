const redis = require('./redisClient')

/**
 * Adapter Redis pro oidc-provider (port do exemplo oficial
 * oidc-provider/example/adapters/redis.js pro nosso ioredis compartilhado).
 * Necessário porque o MemoryAdapter perde codes/grants a cada restart —
 * inaceitável com um client OAuth real registrado (ver comentário em oidc.js).
 */

const grantable = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
])

const consumable = new Set([
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
])

function grantKeyFor(id) {
  return `oidc:grant:${id}`
}

function userCodeKeyFor(userCode) {
  return `oidc:userCode:${userCode}`
}

function uidKeyFor(uid) {
  return `oidc:uid:${uid}`
}

class RedisAdapter {
  constructor(name) {
    this.name = name
  }

  key(id) {
    return `oidc:${this.name}:${id}`
  }

  async upsert(id, payload, expiresIn) {
    const key = this.key(id)
    const multi = redis.multi()

    if (consumable.has(this.name)) {
      multi.hset(key, { payload: JSON.stringify(payload) })
    } else {
      multi.set(key, JSON.stringify(payload))
    }
    if (expiresIn) multi.expire(key, expiresIn)

    if (grantable.has(this.name) && payload.grantId) {
      const grantKey = grantKeyFor(payload.grantId)
      multi.rpush(grantKey, key)
      // garante que a lista do grant vive pelo menos tanto quanto seu token mais longevo
      const ttl = await redis.ttl(grantKey)
      if (expiresIn > ttl) multi.expire(grantKey, expiresIn)
    }

    if (payload.userCode) {
      multi.set(userCodeKeyFor(payload.userCode), id)
      multi.expire(userCodeKeyFor(payload.userCode), expiresIn)
    }

    if (payload.uid) {
      multi.set(uidKeyFor(payload.uid), id)
      multi.expire(uidKeyFor(payload.uid), expiresIn)
    }

    await multi.exec()
  }

  async find(id) {
    if (!id) return undefined
    const data = consumable.has(this.name)
      ? await redis.hgetall(this.key(id))
      : await redis.get(this.key(id))

    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return undefined
    }

    if (typeof data === 'string') return JSON.parse(data)
    const { payload, ...rest } = data
    return { ...rest, ...JSON.parse(payload) }
  }

  async findByUid(uid) {
    const id = await redis.get(uidKeyFor(uid))
    return this.find(id)
  }

  async findByUserCode(userCode) {
    const id = await redis.get(userCodeKeyFor(userCode))
    return this.find(id)
  }

  async destroy(id) {
    await redis.del(this.key(id))
  }

  async revokeByGrantId(grantId) {
    const grantKey = grantKeyFor(grantId)
    const tokens = await redis.lrange(grantKey, 0, -1)
    const multi = redis.multi()
    tokens.forEach((token) => multi.del(token))
    multi.del(grantKey)
    await multi.exec()
  }

  async consume(id) {
    await redis.hset(this.key(id), 'consumed', Math.floor(Date.now() / 1000))
  }
}

module.exports = RedisAdapter
