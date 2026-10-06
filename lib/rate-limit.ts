import { headers } from 'next/headers'

import { redisIncrWithTtl, redisTtl } from './redis'

/**
 * Fixed-window rate limiting backed by Redis.
 *
 * Fails OPEN on purpose: if Redis is down the request is allowed through.
 * A cache outage should never lock every visitor out of the site — the worst
 * outcome would be a self-inflicted outage while trying to prevent one.
 *
 * The identity is `userId` when signed in, otherwise the client IP. Signing
 * in first means one student on a shared campus NAT is not capped by the
 * people behind them.
 */

export type RateLimitResult = {
  ok: boolean
  /** Requests left in this window. -1 when limiting is disabled. */
  remaining: number
  /** Unix seconds when the window resets. */
  resetAt: number
  /** Set when the limit was hit, for the error message. */
  retryAfterSeconds?: number
}

const NAMESPACE = 'rl'

export type RateLimitConfig = {
  /** Logical name, e.g. 'tierlist' — keeps keys readable and separable. */
  name: string
  /** Requests allowed per window. */
  limit: number
  windowSeconds: number
  /** Override the caller identity. Used by tests. */
  identifier?: string | null
}

async function resolveIdentifier(explicit?: string | null): Promise<string> {
  if (explicit !== undefined) return explicit ?? 'anonymous'

  try {
    const session = await (await import('./auth')).auth.api.getSession({
      headers: await headers(),
    })
    if (session?.user?.id) return `u:${session.user.id}`
  } catch {
    // Not signed in, or auth is unhappy — fall through to the IP.
  }

  try {
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')
    if (forwarded) return `ip:${forwarded.split(',')[0]!.trim()}`
    return `ip:${h.get('x-real-ip') ?? 'unknown'}`
  } catch {
    return 'ip:unknown'
  }
}

/**
 * Counts one request against `config` and reports whether it is allowed.
 *
 * Never throws. When Redis is unavailable the result is `ok: true` with
 * `remaining: -1`, which callers read as "limiting is off".
 */
export async function rateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const identifier = await resolveIdentifier(config.identifier)
  const window = Math.max(1, config.windowSeconds)
  const key = `${NAMESPACE}:${config.name}:${identifier}`

  const count = await redisIncrWithTtl(key, window)

  // Redis unavailable → fail open.
  if (count === null) {
    return { ok: true, remaining: -1, resetAt: 0 }
  }

  const ttl = await redisTtl(key)
  const resetIn = ttl !== null && ttl > 0 ? ttl : window

  if (count > config.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: Math.floor(Date.now() / 1000) + resetIn,
      retryAfterSeconds: resetIn,
    }
  }

  return {
    ok: true,
    remaining: Math.max(0, config.limit - count),
    resetAt: Math.floor(Date.now() / 1000) + resetIn,
  }
}

/**
 * Ready-made limits.
 *
 * Deliberately generous for reading, tight for anything that costs money or
 * sends email. These are a floor against casual abuse and bots, not a way to
 * annoy real students on a slow connection.
 */
export const LIMITS = {
  /** Public read endpoints that are expensive to serve. */
  publicRead: { name: 'public-read', limit: 120, windowSeconds: 60 },
  /** Home page — heavy queries, so a lower ceiling. */
  home: { name: 'home', limit: 60, windowSeconds: 60 },
  /** Creating an exam order / applying. */
  registration: { name: 'registration', limit: 10, windowSeconds: 300 },
  /** Payment verification is idempotent but cheap to hammer. */
  payment: { name: 'payment', limit: 30, windowSeconds: 300 },
  /** Sending exam notifications — must not be spammed. */
  examNotify: { name: 'exam-notify', limit: 5, windowSeconds: 600 },
  /** Exam submission. */
  examSubmit: { name: 'exam-submit', limit: 20, windowSeconds: 300 },
  /** Sign in / sign up. */
  auth: { name: 'auth', limit: 10, windowSeconds: 300 },
} as const

/** Standard JSON body for a 429. */
export function tooManyRequests(result: RateLimitResult) {
  return {
    error: 'Too many requests. Please slow down and try again shortly.',
    retryAfter: result.retryAfterSeconds ?? 60,
  }
}