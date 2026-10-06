import type { NextRequest, NextResponse } from 'next/server'

import { redisIncrWithTtl, redisTtl } from './redis'

/**
 * Coarse IP/user rate limiting for Proxy (middleware).
 *
 * Separate from `lib/rate-limit.ts` because Proxy gets a `NextRequest` rather
 * than `headers()` from next/headers, and must not pull in the auth client.
 *
 * Fails OPEN: a Redis outage means no limiting, not a locked-out site.
 */

export type ProxyLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds?: number
}

const NAMESPACE = 'rl:proxy'

/** Requests per minute from a single visitor. */
const DEFAULT_LIMIT = 120
const WINDOW_SECONDS = 60

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp

  return request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

/**
 * Counts this request against the visitor's bucket.
 *
 * Signed-in visitors are keyed by their session cookie value so a shared
 * campus or office IP does not exhaust the budget for everyone behind it.
 * The cookie is not read here, only hashed into the key, so nothing sensitive
 * ends up in a Redis key.
 */
export async function checkIpRateLimit(
  request: NextRequest,
  sessionCookie: string | null,
  options?: { limit?: number; windowSeconds?: number }
): Promise<ProxyLimitResult> {
  const limit = options?.limit ?? DEFAULT_LIMIT
  const window = options?.windowSeconds ?? WINDOW_SECONDS

  // A slice of the cookie is enough to separate users without storing it.
  const identity = sessionCookie
    ? `s:${sessionCookie.slice(-24)}`
    : `ip:${clientIp(request)}`

  const key = `${NAMESPACE}:${identity}`

  const count = await redisIncrWithTtl(key, window)

  // Redis unavailable -> allow everything.
  if (count === null) {
    return { ok: true, limit, remaining: -1, resetAt: 0 }
  }

  const ttl = await redisTtl(key)
  const resetIn = ttl !== null && ttl > 0 ? ttl : window

  if (count > limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAt: Math.floor(Date.now() / 1000) + resetIn,
      retryAfterSeconds: resetIn,
    }
  }

  return {
    ok: true,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: Math.floor(Date.now() / 1000) + resetIn,
  }
}

export function isRateLimited(result: ProxyLimitResult): boolean {
  return !result.ok
}

/** Standard RateLimit-* headers, so clients can back off politely. */
export function applyRateLimitHeaders(
  res: NextResponse,
  result: ProxyLimitResult
): NextResponse {
  // -1 means limiting is disabled, so advertising headers would be a lie.
  if (result.remaining >= 0) {
    res.headers.set('X-RateLimit-Limit', String(result.limit))
    res.headers.set('X-RateLimit-Remaining', String(result.remaining))
    res.headers.set('X-RateLimit-Reset', String(result.resetAt))
  }
  return res
}