'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useState } from 'react'
import {
  Home,
  ListOrdered,
  Inbox,
  User,
  MoreHorizontal,
  Award,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'

/* -------------------------------------------------------------------------- */
/*  Nav config                                                                 */
/* -------------------------------------------------------------------------- */

// Main nav — INTERNSHIPS ki jagah ab "More" button aayega (mobile pe)
const navItems = [
  { name: 'HOME', href: '/', icon: Home },
  { name: 'TIERLIST', href: '/tierlist', icon: ListOrdered },
  // MORE yahan insert hoga dynamically
  { name: 'INBOX', href: '/inbox', icon: Inbox },
  { name: 'PROFILE', href: '/profile', icon: User },
]

// Sheet ke andar dikhne wale pages
const moreItems = [
  {
    name: 'Internships',
    href: '/internships',
    icon: ListOrdered,
    description: 'Browse & apply to open internships',
  },
  {
    name: 'Certificates',
    href: '/certificates',
    icon: Award,
    description: 'Download your earned certificates',
  },
  {
    name: 'Offer Letters',
    href: '/offer-letters',
    icon: FileText,
    description: 'Your internship offer letters',
  },
  {
    name: 'Payment History',
    href: '/payments',
    icon: CreditCard,
    description: 'All your past transactions',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Account preferences',
  },
]

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

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

  // Insert MORE button between TIERLIST and INBOX
  const itemsWithMore = [
    navItems[0], // HOME
    navItems[1], // TIERLIST
    { name: 'MORE', isMore: true as const },
    navItems[2], // INBOX
    navItems[3], // PROFILE
  ]

  return (
    <>
      <motion.nav
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed right-0 bottom-0 left-0 z-50 border-t border-white/10 bg-black/60 backdrop-blur-xl md:border-t md:border-white/10 md:bg-black"
      >
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex h-16 items-center justify-between md:h-20">
            {/* LEFT: Nav items */}
            <div className="flex w-full items-center justify-around md:w-auto md:justify-start md:gap-10">
              {itemsWithMore.map((item) => {
                // More button
                if ('isMore' in item && item.isMore) {
                  return (
                    <button
                      key="more"
                      type="button"
                      onClick={() => setMoreOpen(true)}
                      className="group relative flex flex-col items-center gap-1 px-2 py-2 md:flex-row md:gap-2 md:px-3"
                      aria-label="More options"
                    >
                      {/* Distinct look — circular background */}
                      <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 transition-all group-hover:bg-white/20 group-hover:ring-white/40 md:h-6 md:w-6">
                        <MoreHorizontal
                          className="h-4 w-4 text-white transition-colors md:h-3.5 md:w-3.5"
                          strokeWidth={2.5}
                        />
                      </span>
                      <span className="text-[10px] font-medium tracking-wider text-white/60 transition-colors group-hover:text-white md:text-xs">
                        MORE
                      </span>
                    </button>
                  )
                }

                // Regular nav items
                const navItem = item as (typeof navItems)[number]
                const active = isActive(navItem.href)
                const Icon = navItem.icon

                return (
                  <Link
                    key={navItem.name}
                    href={navItem.href}
                    className="group relative flex flex-col items-center gap-1 px-2 py-2 md:flex-row md:gap-2 md:px-3"
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 transition-colors duration-300',
                        active
                          ? 'text-primary'
                          : 'text-white/60 group-hover:text-white'
                      )}
                      strokeWidth={active ? 2.5 : 2}
                    />
                    <span
                      className={cn(
                        'text-[10px] font-medium tracking-wider transition-colors duration-300 md:text-xs',
                        active
                          ? 'text-primary'
                          : 'text-white/60 group-hover:text-white'
                      )}
                    >
                      {navItem.name}
                    </span>

                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="bg-primary absolute -top-[1px] left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full md:top-auto md:-bottom-[1px] md:left-0 md:w-full md:translate-x-0"
                        transition={{
                          type: 'spring',
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>

            {/* RIGHT: Logo (desktop only) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="hidden items-center md:flex"
            >
              <div className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  style={{ width: '40px' }}
                  alt="INTERNBIRD Logo"
                />
                <div className="flex gap-1">
                  INTERN<div className="text-primary">BIRD</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* ============ MORE SHEET ============ */}
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
              {moreItems.map((item) => {
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
                        <p className="text-sm font-medium">{item.name}</p>
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