import { redisDel, redisDelByPrefix, redisGetJson, redisSetJson } from './redis'

/**
 * Read-through cache for PUBLIC data only.
 *
 * Safety rules, because a cache bug here shows up as wrong data for real users:
 *
 *  - Only ever cache responses that are identical for every visitor. Never put
 *    a session, profile, registration status, payment or tier-list row in here.
 *    Anything derived from "who is asking" must bypass this entirely.
 *  - Every entry is namespaced so invalidation can find it.
 *  - A Redis outage is invisible: `cached()` just calls the loader.
 *
 * Dates are stored as ISO strings because JSON has no Date type, and callers
 * that need real Dates must revive them themselves.
 */

const NAMESPACE = 'ic'
const VERSION = 'v1'

/**
 * Builds the physical Redis key.
 *
 * The tag is part of the KEY, not just metadata. That is what makes
 * `invalidateTag` able to drop a whole group with a single SCAN + DEL — if
 * the tag were stored elsewhere, invalidation would silently match nothing and
 * stale data would live until the TTL expired.
 */
function keyFor(key: string, tag?: string) {
  return tag
    ? `${NAMESPACE}:${VERSION}:${tag}:${key}`
    : `${NAMESPACE}:${VERSION}:${key}`
}

export type CacheOptions = {
  /** Seconds to keep the value. Keep short for anything user-visible. */
  ttlSeconds: number
  /**
   * Group name for invalidation, e.g. 'internships'. Publishing a new exam can
   * then call `invalidateTag('internships')` and drop every related entry at
   * once, instead of having to know each key.
   */
  tag?: string
}

export type CacheResult<T> = {
  value: T
  /** True when this came out of Redis rather than the loader. */
  hit: boolean
}

/**
 * Returns the cached value for `key`, or runs `loader` and caches the result.
 *
 * `loader` must return public data. If it throws, nothing is cached and the
 * error propagates — caching must never mask a real failure.
 */
export async function cached<T>(
  key: string,
  options: CacheOptions,
  loader: () => Promise<T>
): Promise<CacheResult<T>> {
  const physical = keyFor(key, options.tag)

  const hit = await redisGetJson<T>(physical)
  if (hit !== null) {
    return { value: hit, hit: true }
  }

  const value = await loader()
  await redisSetJson(physical, value, options.ttlSeconds)
  return { value, hit: false }
}

/** Like `cached`, but returns only the value. */
export async function cachedValue<T>(
  key: string,
  options: CacheOptions,
  loader: () => Promise<T>
): Promise<T> {
  const { value } = await cached(key, options, loader)
  return value
}

/**
 * Drops every entry under a tag.
 *
 * Call this after anything that changes cached public data — creating or
 * editing an internship, a demand, or toggling visibility.
 */
export async function invalidateTag(tag: string): Promise<void> {
  await redisDelByPrefix(`${NAMESPACE}:v1:${tag}`)
}

/** Drops one specific entry. Pass the same tag it was cached under. */
export async function invalidate(key: string, tag?: string): Promise<void> {
  await redisDel(keyFor(key, tag))
}

/** Shared tag names, so a typo cannot silently fail to invalidate. */
export const CACHE_TAGS = {
  internships: 'internships',
  demands: 'demands',
  stats: 'stats',
  deadlines: 'deadlines',
  tierlist: 'tierlist',
  exams: 'exams',
} as const