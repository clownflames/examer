import Redis from 'ioredis'

/**
 * Redis access that NEVER takes the site down.
 *
 * Two rules this file exists to enforce:
 *
 *  1. If Redis is missing or unreachable, every helper returns a safe
 *     default and the caller falls back to Postgres. Caching becomes a no-op
 *     and rate limiting fails OPEN — an outage in the cache must never turn
 *     into an outage of the product.
 *
 *  2. Nothing here throws. Callers are ordinary request handlers and should
 *     never have to wrap a cache read in try/catch.
 */

const URL = process.env.REDIS_URL?.trim()

/** How long a failed connection keeps being retried before we give up for a while. */
const RETRY_WINDOW_MS = 30_000

let client: Redis | null = null
let unavailableUntil = 0
let connecting: Promise<Redis | null> | null = null

/**
 * Returns a connected client, or null when Redis cannot be used.
 *
 * `lazyConnect` + a short circuit on `unavailableUntil` means a dead Redis is
 * probed at most once per window instead of on every request.
 */
export async function getRedis(): Promise<Redis | null> {
  if (!URL) return null

  // Back off after a failure so we are not retrying on every single call.
  if (Date.now() < unavailableUntil) return null

  if (client) return client

  // Collapse concurrent callers onto one connection attempt.
  connecting ??= (async () => {
    const instance = new Redis(URL, {
      lazyConnect: true,
      // Fail fast — a slow Redis must not pile up requests.
      connectTimeout: 2_000,
      commandTimeout: 2_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (unavailableUntil && Date.now() < unavailableUntil) return null
        return Math.min(times * 200, 2_000)
      },
    })

    // Without a listener ioredis turns connection errors into unhandled
    // rejections, which would take the process down.
    instance.on('error', (err) => {
      console.warn('[redis] connection error:', err?.message ?? err)
      unavailableUntil = Date.now() + RETRY_WINDOW_MS
    })

    try {
      await instance.connect()
      await instance.ping()
      unavailableUntil = 0
      connecting = null
      return instance
    } catch (err) {
      console.warn(
        '[redis] unavailable, falling back to direct database access:',
        (err as Error)?.message ?? err
      )
      unavailableUntil = Date.now() + RETRY_WINDOW_MS
      connecting = null
      instance.disconnect()
      return null
    }
  })()

  return connecting
}

/** True when Redis answered a ping recently enough to be trusted. */
export async function isRedisAvailable(): Promise<boolean> {
  const redis = await getRedis()
  return redis !== null
}

/** Best-effort GET + JSON.parse. Returns null on miss or any failure. */
export async function redisGetJson<T>(key: string): Promise<T | null> {
  const redis = await getRedis()
  if (!redis) return null

  try {
    const raw = await redis.get(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch (err) {
    console.warn(`[redis] get failed for ${key}:`, (err as Error)?.message ?? err)
    return null
  }
}

/** Best-effort SET with TTL in seconds. Never throws. */
export async function redisSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<boolean> {
  const redis = await getRedis()
  if (!redis) return false

  try {
    await redis.set(key, JSON.stringify(value), 'EX', Math.max(1, ttlSeconds))
    return true
  } catch (err) {
    console.warn(`[redis] set failed for ${key}:`, (err as Error)?.message ?? err)
    return false
  }
}

/** Best-effort DEL of one or more keys. Never throws. */
export async function redisDel(...keys: string[]): Promise<number> {
  if (keys.length === 0) return 0
  const redis = await getRedis()
  if (!redis) return 0

  try {
    return await redis.del(...keys)
  } catch (err) {
    console.warn('[redis] del failed:', (err as Error)?.message ?? err)
    return 0
  }
}

/**
 * Deletes every key under a prefix.
 *
 * Uses SCAN rather than KEYS so it stays safe on a large keyspace — KEYS
 * blocks the server, which is exactly what we are trying to avoid.
 */
export async function redisDelByPrefix(prefix: string): Promise<number> {
  const redis = await getRedis()
  if (!redis) return 0

  let removed = 0
  try {
    let cursor = '0'
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        200
      )
      cursor = next
      if (keys.length > 0) {
        removed += await redis.del(...keys)
      }
    } while (cursor !== '0')
  } catch (err) {
    console.warn('[redis] prefix delete failed:', (err as Error)?.message ?? err)
  }
  return removed
}

/**
 * Atomic counter increment with an expiry, used by the rate limiter.
 *
 * Returns null when Redis is unavailable so the caller can fail open.
 */
export async function redisIncrWithTtl(
  key: string,
  windowSeconds: number
): Promise<number | null> {
  const redis = await getRedis()
  if (!redis) return null

  try {
    // MULTI keeps "increment" and "set expiry on first hit" atomic, so a
    // crash between them cannot leave a key that never expires.
    const results = await redis
      .multi()
      .incr(key)
      .expire(key, windowSeconds, 'NX')
      .exec()

    const first = results?.[0]?.[1]
    return typeof first === 'number' ? first : null
  } catch (err) {
    console.warn(`[redis] incr failed for ${key}:`, (err as Error)?.message ?? err)
    return null
  }
}

/** Remaining TTL in seconds; -2 when the key does not exist, -1 when no TTL. */
export async function redisTtl(key: string): Promise<number | null> {
  const redis = await getRedis()
  if (!redis) return null
  try {
    return await redis.ttl(key)
  } catch {
    return null
  }
}

/** Test seam — lets verification scripts reset module state. */
export function __resetRedisStateForTests() {
  unavailableUntil = 0
  connecting = null
  if (client) {
    client.disconnect()
    client = null
  }
}

export function __isRedisConfigured() {
  return Boolean(URL)
}