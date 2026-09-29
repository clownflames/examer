// proxy.ts (project root me)
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — no auth needed
  const publicPaths = ['/', '/tierlist', '/internships', '/login', '/register', '/forgot-password']
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))
  
  // Exam start — server side paid gate hai, login bhi server check karega
  const isExamStart = pathname.startsWith('/exams/') && pathname.endsWith('/start')

  if (isPublic || isExamStart) return NextResponse.next()

  // Protected: check cookie
  const sessionCookie = getSessionCookie(request)

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin gate — role check server side
  if (pathname.startsWith('/admin')) {
    // Better: check role via a lightweight cookie or trust server page
    // (role check bhi server side hoga)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image
     * - favicon, images, fonts
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|images|fonts|api|.*\\..*).*)',
  ],
}