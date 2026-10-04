'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, useMotionValue } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import {
  Home,
  ListOrdered,
  Inbox,
  User,
  MoreHorizontal,
  Award,
  FileText,
  CreditCard,
  ChevronDown,
  LogIn,
  LogOut,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { authClient, useSession } from '@/lib/auth-client'
import { useLenis } from '@/components/smooth-scroll'

/* -------------------------------------------------------------------------- */
/*  Nav config                                                                 */
/* -------------------------------------------------------------------------- */

// Primary links — mobile bottom bar aur desktop top bar dono me.
// PROFILE / LOGIN runtime pe decide hota hai (session ke hisaab se).
const primaryItems = [
  { name: 'HOME', href: '/', icon: Home },
  { name: 'TIERLIST', href: '/tierlist', icon: ListOrdered },
  { name: 'INBOX', href: '/inbox', icon: Inbox },
]

// Secondary links — mobile ke "More" sheet me, desktop pe seedhe top bar me.
// NOTE: Settings jaan-boojh kar nahi rakha gaya — wo Profile page se manage hota hai.
const secondaryItems = [
  {
    name: 'INTERNSHIPS',
    sheetName: 'Internships',
    href: '/internships',
    icon: ListOrdered,
    description: 'Browse & apply to open internships',
  },
  {
    name: 'PAYMENTS',
    sheetName: 'Payment History',
    href: '/payments',
    icon: CreditCard,
    description: 'All your past transactions',
  },
]

// Documents — desktop pe ek "DOCUMENTS" dropdown me, mobile sheet me alag-alag
const documentItems = [
  {
    name: 'CERTIFICATES',
    sheetName: 'Certificates',
    href: '/certificates',
    icon: Award,
    description: 'Download your earned certificates',
  },
  {
    name: 'OFFER LETTERS',
    sheetName: 'Offer Letters',
    href: '/offer-letters',
    icon: FileText,
    description: 'Your internship offer letters',
  },
]

// Sheet (mobile + tablet) me total kya dikhega
const sheetItems = [...secondaryItems, ...documentItems]

// Session ke hisaab se PROFILE ya LOGIN — dono jagah chahiye
const profileItem = { name: 'PROFILE', href: '/profile', icon: User }
const loginItem = { name: 'LOGIN', href: '/login', icon: LogIn }

function buildPrimaryItems(isLoggedIn: boolean) {
  return isLoggedIn
    ? [...primaryItems, profileItem]
    : [...primaryItems, loginItem]
}

// Mobile bottom bar: HOME · TIERLIST · MORE · INBOX · PROFILE/LOGIN
function buildMobileItems(isLoggedIn: boolean) {
  const items = buildPrimaryItems(isLoggedIn)
  return [
    items[0],
    items[1],
    { name: 'MORE', isMore: true as const },
    items[2],
    items[3],
  ]
}

/* -------------------------------------------------------------------------- */
/*  Nav link                                                                   */
/* -------------------------------------------------------------------------- */

type NavItem = {
  name: string
  href: string
  icon: typeof Home
}

function NavLink({
  item,
  active,
  layoutId,
  className,
}: {
  item: NavItem
  active: boolean
  layoutId: string
  className?: string
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex flex-col items-center gap-1 rounded-xl px-2 py-2',
        'transition-colors md:flex-row md:gap-1.5 md:rounded-lg md:px-2.5 md:py-1.5 md:hover:bg-white/5',
        className
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5 transition-colors duration-300 md:h-[15px] md:w-[15px]',
          active ? 'text-primary' : 'text-white/60 group-hover:text-white'
        )}
        strokeWidth={active ? 2.5 : 2}
      />
      <span
        className={cn(
          'text-[10px] font-medium tracking-wider transition-colors duration-300',
          'md:text-[13px] md:tracking-normal',
          active ? 'text-primary' : 'text-white/60 group-hover:text-white'
        )}
      >
        {item.name}
      </span>

      {active && (
        <motion.div
          layoutId={layoutId}
          className="bg-primary absolute -top-[1px] left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full md:top-auto md:-bottom-[1px] md:left-1.5 md:right-1.5 md:w-auto md:translate-x-0"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </Link>
  )
}

/* -------------------------------------------------------------------------- */
/*  Documents dropdown (desktop only)                                          */
/*  Certificates + Offer Letters ek dropdown me — nav bar ko chhota rakhte   */
/*  hain bina kuch hidden kiye.                                                */
/* -------------------------------------------------------------------------- */

function DocumentsDropdown() {
  const pathname = usePathname()
  const active = documentItems.some((item) => pathname.startsWith(item.href))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              'group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5',
              'transition-colors hover:bg-white/5',
              active ? 'text-primary' : 'text-white/60 hover:text-white'
            )}
          >
            <Award
              className={cn(
                'h-[15px] w-[15px] transition-colors duration-300',
                active ? 'text-primary' : 'text-white/60 group-hover:text-white'
              )}
              strokeWidth={active ? 2.5 : 2}
            />
            <span className="text-[13px] font-medium">DOCUMENTS</span>
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform duration-200',
                active ? 'text-primary' : 'text-white/50 group-hover:text-white'
              )}
            />
          </button>
        }
      />

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 rounded-xl p-1.5"
      >
        {documentItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)

          return (
            <DropdownMenuItem
              key={item.href}
              render={
                <Link
                  href={item.href}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 outline-none transition-colors',
                    'hover:bg-white/5 focus-visible:bg-white/5',
                    isActive && 'bg-primary/10'
                  )}
                />
              }
            >
              <div
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'bg-white/5 text-white/60'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-[13px] font-medium',
                    isActive ? 'text-primary' : 'text-white'
                  )}
                >
                  {item.sheetName}
                </p>
                <p className="text-muted-foreground truncate text-[11px]">
                  {item.description}
                </p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Logged in → PROFILE, logged out → LOGIN
  const { data: session, isPending: sessionLoading } = useSession()
  const isLoggedIn = !!session?.user

  // Desktop top bar scroll ke saath hide/show hoga (mobile bottom bar hamesha visible)
  const [hidden, setHidden] = useState(false)
  const lenis = useLenis()
  const progress = useMotionValue(0)
  const lastScroll = useRef(0)

  // Session pending tak PROFILE dikhao — warna hydration mismatch hoga
  const primary = buildPrimaryItems(sessionLoading ? true : isLoggedIn)
  const mobileItems = buildMobileItems(sessionLoading ? true : isLoggedIn)
  const desktopItems = [...primary, ...secondaryItems]

  useEffect(() => {
    if (!lenis) return

    return lenis.on('scroll', (l) => {
      progress.set(l.progress)

      // Neeche scroll karte hue chhupao, upar scroll karte waqt wapas laao.
      // Top pe hamesha dikhao.
      const delta = l.scroll - lastScroll.current
      lastScroll.current = l.scroll
      setHidden(l.scroll > 160 && delta > 0)
    })
  }, [lenis, progress])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success('Signed out')
            router.push('/')
            router.refresh()
          },
          onError: () => {
            toast.error('Could not sign out')
          },
        },
      })
    } catch (err) {
      console.error(err)
      toast.error('Could not sign out')
    } finally {
      setSigningOut(false)
      setMoreOpen(false)
    }
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/*
        Mobile  → fixed bottom bar (thumb reach)
        Desktop → fixed top bar, scroll down pe chhup jaata hai
      */}
      <nav
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 md:top-0 md:bottom-auto',
          'border-white/10 bg-black/70 backdrop-blur-xl md:border-b md:bg-black/60 md:shadow-[0_10px_30px_-20px_rgba(0,0,0,0.9)]',
          'transition-transform duration-300 ease-out will-change-transform',
          hidden ? 'md:-translate-y-full' : 'translate-y-0'
        )}
      >
        {/* Scroll progress — mobile: bar ke upar, desktop: bar ke neeche */}
        <motion.div
          aria-hidden
          style={{ scaleX: progress }}
          className="bg-primary absolute inset-x-0 top-0 h-0.5 origin-left md:top-auto md:bottom-0"
        />

        {/* Safe-area bottom padding sirf mobile bottom bar pe (iPhone gesture bar) */}
        <div className="mx-auto max-w-7xl px-4 pb-[env(safe-area-inset-bottom)] md:px-6 md:pb-0">
          {/* ============ MOBILE — bottom bar ============ */}
          <div className="flex h-16 items-center justify-around md:hidden">
            {mobileItems.map((item) => {
              if ('isMore' in item && item.isMore) {
                return (
                  <button
                    key="more"
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    className="group relative flex flex-col items-center gap-1 rounded-xl px-2 py-2"
                    aria-label="More options"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 transition-all group-hover:bg-white/20 group-hover:ring-white/40">
                      <MoreHorizontal
                        className="h-4 w-4 text-white"
                        strokeWidth={2.5}
                      />
                    </span>
                    <span className="text-[10px] font-medium tracking-wider text-white/60 transition-colors group-hover:text-white">
                      MORE
                    </span>
                  </button>
                )
              }

              const navItem = item as NavItem
              return (
                <NavLink
                  key={navItem.name}
                  item={navItem}
                  active={isActive(navItem.href)}
                  layoutId="nav-indicator-mobile"
                />
              )
            })}
          </div>

          {/* ============ DESKTOP — top bar ============ */}
          <div className="hidden h-14 items-center justify-between md:flex">
            {/* LEFT: Logo */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex shrink-0 items-center"
            >
              <Link
                href="/"
                className="flex items-center gap-1.5"
                aria-label="InternBird home"
              >
                <Image
                  src="/logo.png"
                  alt=""
                  width={30}
                  height={30}
                  className="h-7 w-7 object-contain"
                />
                <span className="text-[13px] font-semibold tracking-tight text-white">
                  INTERN<span className="text-primary">BIRD</span>
                </span>
              </Link>
            </motion.div>

            {/* RIGHT: Saare links (MORE sirf tablet pe, xl+ pe sab direct) */}
            <div className="flex items-center gap-0.5">
              {desktopItems.map((item) => {
                const isSecondary = secondaryItems.includes(item as never)

                return (
                  <NavLink
                    key={item.name}
                    item={item}
                    active={isActive(item.href)}
                    layoutId="nav-indicator-desktop"
                    // Secondary links sirf xl+ pe — niche MORE button unke
                    // jagah aa jata hai
                    className={isSecondary ? 'hidden xl:flex' : undefined}
                  />
                )
              })}

              {/* Certificates + Offer Letters ek dropdown me (xl+) */}
              <div className="hidden xl:block">
                <DocumentsDropdown />
              </div>

              {/* Sirf tablet (md → xl) pe, jab saare links fit nahi hote */}
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="group relative hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-white/60 transition-colors hover:bg-white/5 hover:text-white md:flex xl:hidden"
                aria-label="More options"
              >
                <MoreHorizontal className="h-[15px] w-[15px]" strokeWidth={2.5} />
                <span className="text-[13px] font-medium">MORE</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ============ MORE SHEET (mobile / tablet) ============ */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-sm"
        >
          {/* Header */}
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="text-base font-semibold">More</SheetTitle>
          </SheetHeader>

          {/* Links */}
          <div className="flex-1 overflow-y-auto px-2 py-3">
            <ul className="flex flex-col gap-1">
              {sheetItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          active
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.sheetName}</p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {item.description}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Footer: Logout */}
          <div className="border-t px-3 py-3">
            <Button
              variant="ghost"
              onClick={handleSignOut}
              disabled={signingOut}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full justify-start gap-3 rounded-xl px-3 py-2.5"
            >
              <div className="bg-destructive/10 text-destructive flex h-8 w-8 items-center justify-center rounded-lg">
                <LogOut className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">
                {signingOut ? 'Signing out…' : 'Logout'}
              </span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}