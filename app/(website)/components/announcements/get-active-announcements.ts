'use server'

import { and, asc, eq, isNull, lte, or, gte, type SQL } from 'drizzle-orm'

import { db } from '@/db'
import { announcements } from '@/db/schema'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ActiveAnnouncement = {
  id: string
  title: string
  content: string
  variant: 'info' | 'success' | 'warning' | 'error'
  dismissible: boolean
  displayOnce: boolean
  ctaText: string | null
  ctaUrl: string | null
  targetPages: string[]
}

/* -------------------------------------------------------------------------- */
/*  Fetch                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Fetches all active announcements that:
 *  - isActive = true
 *  - startsAt is null OR startsAt <= now
 *  - endsAt is null OR endsAt >= now
 *  - ordered by priority asc, then createdAt desc
 *
 * We do NOT filter by page here — the client decides that (so we can cache
 * this list and reuse across navigations without a new fetch).
 */
export async function getActiveAnnouncements(): Promise<
  ActiveAnnouncement[]
> {
  try {
    const now = new Date()

    const conditions: SQL[] = [eq(announcements.isActive, true)]

    // startsAt is null OR startsAt <= now
    const startsOk = or(
      isNull(announcements.startsAt),
      lte(announcements.startsAt, now)
    )
    if (startsOk) conditions.push(startsOk)

    // endsAt is null OR endsAt >= now
    const endsOk = or(
      isNull(announcements.endsAt),
      gte(announcements.endsAt, now)
    )
    if (endsOk) conditions.push(endsOk)

    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        variant: announcements.variant,
        dismissible: announcements.dismissible,
        displayOnce: announcements.displayOnce,
        ctaText: announcements.ctaText,
        ctaUrl: announcements.ctaUrl,
        targetPages: announcements.targetPages,
      })
      .from(announcements)
      .where(and(...conditions))
      .orderBy(asc(announcements.priority))

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      variant: r.variant,
      dismissible: r.dismissible,
      displayOnce: r.displayOnce,
      ctaText: r.ctaText,
      ctaUrl: r.ctaUrl,
      targetPages: (r.targetPages as string[]) ?? [],
    }))
  } catch (error) {
    console.error('[announcements] getActiveAnnouncements error:', error)
    return []
  }
}