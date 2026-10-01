'use server'

import crypto from 'crypto'
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { db } from '@/db'
import { announcements } from '@/db/schema'
import { auth } from '@/lib/auth'

import {
  PAGE_SIZE,
  type AnnouncementDetail,
  type AnnouncementFilter,
  type AnnouncementRow,
  type AnnouncementVariant,
} from './constants'

/* -------------------------------------------------------------------------- */
/*  Auth guard                                                                 */
/* -------------------------------------------------------------------------- */

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user || role !== 'admin') {
    throw new Error('Unauthorized')
  }
  return session.user
}

/* -------------------------------------------------------------------------- */
/*  Mapper                                                                     */
/* -------------------------------------------------------------------------- */

type DbAnnouncement = typeof announcements.$inferSelect

function toRow(r: DbAnnouncement): AnnouncementRow {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    variant: r.variant,
    isActive: r.isActive,
    dismissible: r.dismissible,
    displayOnce: r.displayOnce,
    startsAt: r.startsAt ? new Date(r.startsAt).toISOString() : null,
    endsAt: r.endsAt ? new Date(r.endsAt).toISOString() : null,
    targetPages: (r.targetPages as string[]) ?? [],
    ctaText: r.ctaText,
    ctaUrl: r.ctaUrl,
    priority: r.priority,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  }
}

/* -------------------------------------------------------------------------- */
/*  Where builder                                                              */
/* -------------------------------------------------------------------------- */

function buildWhere(filter: AnnouncementFilter): SQL | undefined {
  const conditions: SQL[] = []
  const status = filter.status ?? 'all'
  const q = (filter.query ?? '').trim()

  if (status === 'active') {
    conditions.push(eq(announcements.isActive, true))
  } else if (status === 'inactive') {
    conditions.push(eq(announcements.isActive, false))
  }

  if (q) {
    const pattern = `%${q}%`
    const search = or(
      ilike(announcements.title, pattern),
      ilike(announcements.content, pattern)
    )
    if (search) conditions.push(search)
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getAnnouncements(
  page = 1,
  filter: AnnouncementFilter = {}
): Promise<{
  data: AnnouncementRow[]
  page: number
  totalPages: number
  total: number
}> {
  try {
    await requireAdmin()

    const safePage = Math.max(1, Math.floor(page) || 1)
    const offset = (safePage - 1) * PAGE_SIZE
    const where = buildWhere(filter)

    const rows = await db
      .select()
      .from(announcements)
      .where(where)
      .orderBy(desc(announcements.priority), desc(announcements.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset)

    const totalResult = await db
      .select({ value: count() })
      .from(announcements)
      .where(where)

    const total = Number(totalResult[0]?.value ?? 0)
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return { data: rows.map(toRow), page: safePage, totalPages, total }
  } catch (error) {
    console.error('[announcements] getAnnouncements error:', error)
    return { data: [], page: 1, totalPages: 1, total: 0 }
  }
}

/* -------------------------------------------------------------------------- */
/*  Get single                                                                 */
/* -------------------------------------------------------------------------- */

export async function getAnnouncementById(
  id: string
): Promise<AnnouncementDetail | null> {
  try {
    await requireAdmin()

    const [row] = await db
      .select()
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1)

    if (!row) return null
    return toRow(row)
  } catch (error) {
    console.error('[announcements] getAnnouncementById error:', error)
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Save                                                                       */
/* -------------------------------------------------------------------------- */

export type AnnouncementInput = {
  id?: string | null
  title: string
  content: string
  variant: AnnouncementVariant
  isActive: boolean
  dismissible: boolean
  displayOnce: boolean
  startsAt: string | null
  endsAt: string | null
  targetPages: string[]
  ctaText: string | null
  ctaUrl: string | null
  priority: number
}

export async function saveAnnouncement(
  input: AnnouncementInput
): Promise<
  { success: true; id: string } | { success: false; error: string }
> {
  try {
    const admin = await requireAdmin()

    if (!input.title.trim()) {
      return { success: false, error: 'Title is required' }
    }
    if (!input.content.trim()) {
      return { success: false, error: 'Content is required' }
    }

    const payload = {
      title: input.title.trim(),
      content: input.content.trim(),
      variant: input.variant,
      isActive: input.isActive,
      dismissible: input.dismissible,
      displayOnce: input.displayOnce,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      targetPages: input.targetPages ?? [],
      ctaText: input.ctaText?.trim() || null,
      ctaUrl: input.ctaUrl?.trim() || null,
      priority: input.priority,
    }

    if (input.id) {
      const updated = await db
        .update(announcements)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(announcements.id, input.id))
        .returning({ id: announcements.id })

      if (updated.length === 0) {
        return { success: false, error: 'Announcement not found' }
      }

      revalidatePath('/admin/announcements')
      revalidatePath(`/admin/announcements/${input.id}/edit`)
      return { success: true, id: input.id }
    }

    const id = crypto.randomUUID()
    await db.insert(announcements).values({
      id,
      ...payload,
      createdBy: admin.id,
    })

    revalidatePath('/admin/announcements')
    return { success: true, id }
  } catch (error) {
    console.error('[announcements] saveAnnouncement error:', error)
    return { success: false, error: 'Could not save' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Toggle                                                                     */
/* -------------------------------------------------------------------------- */

export async function toggleAnnouncementActive(
  id: string,
  isActive: boolean
): Promise<
  { success: true; isActive: boolean } | { success: false; error: string }
> {
  try {
    await requireAdmin()

    const updated = await db
      .update(announcements)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning({ id: announcements.id, isActive: announcements.isActive })

    if (updated.length === 0) {
      return { success: false, error: 'Not found' }
    }

    revalidatePath('/admin/announcements')
    return { success: true, isActive: updated[0].isActive }
  } catch (error) {
    console.error('[announcements] toggleAnnouncementActive error:', error)
    return { success: false, error: 'Could not update' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteAnnouncement(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin()

    const deleted = await db
      .delete(announcements)
      .where(eq(announcements.id, id))
      .returning({ id: announcements.id })

    if (deleted.length === 0) {
      return { success: false, error: 'Not found' }
    }

    revalidatePath('/admin/announcements')
    return { success: true }
  } catch (error) {
    console.error('[announcements] deleteAnnouncement error:', error)
    return { success: false, error: 'Could not delete' }
  }
}