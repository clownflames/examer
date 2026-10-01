'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { ActiveAnnouncement } from './get-active-announcements'

/* -------------------------------------------------------------------------- */
/*  Storage                                                                    */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = 'internbird:announcements:dismissed'

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function AnnouncementBar({
  announcements,
}: {
  announcements: ActiveAnnouncement[]
}) {
  const pathname = usePathname()
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set())
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const ids = JSON.parse(raw)
        if (Array.isArray(ids)) setDismissed(new Set(ids))
      }
    } catch {
      // ignore
    }
  }, [])

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // ignore
      }
      return next
    })
  }

  const visible = React.useMemo(() => {
    if (!mounted) return []

    return announcements.filter((a) => {
      if (dismissed.has(a.id)) return false

      if (!a.targetPages || a.targetPages.length === 0) return true

      return a.targetPages.some(
        (target) =>
          pathname === target || pathname.startsWith(target + '/')
      )
    })
  }, [announcements, dismissed, mounted, pathname])

  if (!mounted || visible.length === 0) return null

  return (
    <div className="flex flex-col">
      {visible.map((a) => (
        <div
          key={a.id}
          role="status"
          className={cn(
            // Always black background, white text
            'relative w-full bg-black text-white',
            'border-b border-white/10',
            'px-4 py-2.5 text-sm'
          )}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-3">
            {/* Content — centered */}
            <p className="min-w-0 text-center leading-snug">
              <span className="font-semibold">{a.title}</span>
              {a.content && (
                <>
                  {' '}
                  <span
                    className="inline font-normal text-white/85"
                    dangerouslySetInnerHTML={{ __html: a.content }}
                  />
                </>
              )}
            </p>

            {/* CTA */}
            {a.ctaText && a.ctaUrl && (
              <Link
                href={a.ctaUrl}
                className={cn(
                  'shrink-0 rounded-md border border-white/25 px-2.5 py-1',
                  'text-xs font-semibold whitespace-nowrap',
                  'transition-colors hover:bg-white/10'
                )}
              >
                {a.ctaText}
              </Link>
            )}
          </div>

          {/* Dismiss — absolute right */}
          {a.dismissible && (
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              className={cn(
                'absolute top-1/2 right-3 -translate-y-1/2',
                'rounded-md p-1 text-white/70 transition-colors',
                'hover:bg-white/10 hover:text-white'
              )}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}