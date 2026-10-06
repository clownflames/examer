// proxy.ts (project root me)
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

import {
  applyRateLimitHeaders,
  checkIpRateLimit,
  isRateLimited,
} from './lib/proxy-rate-limit'

/**
 * Rate limiting + route protection, before any server action or database work.
 *
 * Proxy runs on the Node.js runtime by default as of Next 16, so a real Redis
 * client works here. The limiter fails OPEN — if Redis is down this file simply
 * lets the request through, because a cache outage must never become a site
 * outage.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.url
    ? new URL(request.url)
    : { pathname: '/' }

  // ---- rate limit ----
  // Signed-in visitors are keyed by session cookie so a shared campus IP does
  // not exhaust the budget for everyone behind it.
  const sessionCookie = getSessionCookie(request)
  const limit = await checkIpRateLimit(request, sessionCookie)

  if (isRateLimited(limit)) {
    const retryAfter = String(limit.retryAfterSeconds ?? 60)
    const res = new NextResponse(
      JSON.stringify({
        error: 'Too many requests. Please slow down and try again shortly.',
        retryAfter: Number(retryAfter),
      }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': retryAfter,
        },
      },
    )
    return applyRateLimitHeaders(res, limit)
  }

  // ---- route protection ----
  // Public routes — no auth needed
  const publicPaths = [
    '/',
    '/tierlist',
    '/internships',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/api/auth', // better-auth ke saare routes
    // Certificate verification is public - an employer verifying won't have a
    // login. NOTE: '/certificates' itself stays protected (user's own list).
    '/certificates/verify',
    '/offer-letters/verify',
  ]
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  // Exam start — server side paid gate hai, login bhi server check karega
  const isExamStart =
    pathname.startsWith('/exams/') && pathname.endsWith('/start')

  let res: NextResponse

  if (isPublic || isExamStart) {
    res = NextResponse.next()
  } else if (pathname.startsWith('/api/')) {
    // API routes must never be answered with a redirect to the login page — a
    // fetch() would receive an HTML document with status 200 and no useful
    // signal. Return a JSON 401 instead and let the route run its own
    // authorization once a session exists.
    res = sessionCookie
      ? NextResponse.next()
      : NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
  } else if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    res = NextResponse.redirect(loginUrl)
  } else {
    // Admin gate — role check server side (page-level actions re-check it too).
    res = NextResponse.next()
  }

  return applyRateLimitHeaders(res, limit)
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|images|fonts|.*\\..*).*)',
  ],
}