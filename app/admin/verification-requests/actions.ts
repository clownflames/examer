'use server'

import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { db } from '@/db'
import { certificates, user, verificationRequests } from '@/db/schema'
import { auth } from '@/lib/auth'
import {
  PAGE_SIZE,
  reviewSchema,
  type ReviewInput,
  type VerificationFilter,
  type VerificationRequestRow,
} from './constants'

export type { VerificationRequestRow }

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
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getVerificationRequests(
  page = 1,
  filter: VerificationFilter = 'pending'
): Promise<{
  data: VerificationRequestRow[]
  page: number
  totalPages: number
  total: number
}> {
  try {
    await requireAdmin()

    const safePage = Math.max(1, Math.floor(page) || 1)
    const offset = (safePage - 1) * PAGE_SIZE

    const conditions: SQL[] = []
    if (filter !== 'all') {
      conditions.push(eq(verificationRequests.status, filter))
    }

    const whereClause = conditions.length ? and(...conditions) : undefined

    const rows = await db
      .select({
        id: verificationRequests.id,
        status: verificationRequests.status,
        userId: verificationRequests.userId,
        userName: user.name,
        userEmail: user.email,
        certificateId: verificationRequests.certificateId,
        certificateNo: certificates.certificateNo,
        certificateTitle: certificates.title,
        verifierName: verificationRequests.verifierName,
        verifierEmail: verificationRequests.verifierEmail,
        organisation: verificationRequests.organisation,
        note: verificationRequests.note,
        reviewNote: verificationRequests.reviewNote,
        reviewedAt: verificationRequests.reviewedAt,
        createdAt: verificationRequests.createdAt,
      })
      .from(verificationRequests)
      .innerJoin(user, eq(verificationRequests.userId, user.id))
      .leftJoin(
        certificates,
        eq(verificationRequests.certificateId, certificates.id)
      )
      .where(whereClause)
      .orderBy(desc(verificationRequests.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset)

    const totalResult = await db
      .select({ value: count() })
      .from(verificationRequests)
      .where(whereClause)

    const total = Number(totalResult[0]?.value ?? 0)
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return {
      data: rows.map((r) => ({
        ...r,
        organisation: r.organisation,
        note: r.note,
        reviewNote: r.reviewNote,
      })),
      page: safePage,
      totalPages,
      total,
    }
  } catch (error) {
    console.error('[verification-requests] getVerificationRequests error:', error)
    return { data: [], page: 1, totalPages: 1, total: 0 }
  }
}

/* -------------------------------------------------------------------------- */
/*  Counts (for the filter badges)                                            */
/* -------------------------------------------------------------------------- */

export async function getVerificationCounts(): Promise<
  Record<VerificationFilter, number>
> {
  try {
    await requireAdmin()

    const rows = await db
      .select({ status: verificationRequests.status, value: count() })
      .from(verificationRequests)
      .groupBy(verificationRequests.status)

    const base: Record<VerificationFilter, number> = {
      all: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    }

    for (const row of rows) {
      base[row.status] = Number(row.value)
      base.all += Number(row.value)
    }

    return base
  } catch (error) {
    console.error('[verification-requests] getVerificationCounts error:', error)
    return { all: 0, pending: 0, approved: 0, rejected: 0 }
  }
}

/* -------------------------------------------------------------------------- */
/*  Approve / Reject                                                           */
/* -------------------------------------------------------------------------- */

export async function reviewVerificationRequest(
  id: string,
  input: ReviewInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const admin = await requireAdmin()

    const parsed = reviewSchema.parse(input)

    const updated = await db
      .update(verificationRequests)
      .set({
        status: parsed.status,
        reviewNote: parsed.reviewNote || null,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      })
      .where(eq(verificationRequests.id, id))
      .returning({ id: verificationRequests.id })

    if (updated.length === 0) {
      return { success: false as const, error: 'Request not found.' }
    }

    revalidatePath('/admin/verification-requests')
    revalidatePath('/certificates')

    return { success: true as const }
  } catch (err) {
    console.error('reviewVerificationRequest failed:', err)
    return { success: false as const, error: 'Failed to review request.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Search by certificate no (admin quick lookup)                             */
/* -------------------------------------------------------------------------- */

export async function searchVerificationRequests(query: string) {
  try {
    await requireAdmin()

    const q = query.trim()
    if (!q) return { data: [], total: 0 }

    const whereClause = or(
      ilike(certificates.certificateNo, `%${q}%`),
      ilike(user.email, `%${q}%`),
      ilike(verificationRequests.verifierEmail, `%${q}%`)
    )!

    const rows = await db
      .select({
        id: verificationRequests.id,
        certificateNo: certificates.certificateNo,
        userEmail: user.email,
        verifierEmail: verificationRequests.verifierEmail,
        status: verificationRequests.status,
      })
      .from(verificationRequests)
      .innerJoin(user, eq(verificationRequests.userId, user.id))
      .leftJoin(
        certificates,
        eq(verificationRequests.certificateId, certificates.id)
      )
      .where(whereClause)
      .limit(20)

    return { data: rows, total: rows.length }
  } catch (error) {
    console.error('[verification-requests] search error:', error)
    return { data: [], total: 0 }
  }
}