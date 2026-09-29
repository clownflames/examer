
'use server'

import { and, count, desc, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'

import { db } from '@/db'
import { payments, internships, employeeDemand } from '@/db/schema'
import { auth } from '@/lib/auth'

import {
  PAGE_SIZE,
  type PaymentRow,
  type PaymentStats,
  type PaymentFilterStatus,
} from './constants'

/* -------------------------------------------------------------------------- */
/*  Current user                                                               */
/* -------------------------------------------------------------------------- */

async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id ?? null
  } catch (error) {
    console.error('[payments] currentUserId error:', error)
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getMyPaymentsPaginated(
  page = 1,
  status: PaymentFilterStatus = 'all'
): Promise<{
  data: PaymentRow[]
  page: number
  totalPages: number
  total: number
}> {
  const userId = await currentUserId()
  if (!userId) {
    return { data: [], page: 1, totalPages: 1, total: 0 }
  }

  const safePage = Math.max(1, Math.floor(page) || 1)
  const offset = (safePage - 1) * PAGE_SIZE

  const filters = [eq(payments.userId, userId)]
  if (status !== 'all') {
    filters.push(eq(payments.status, status))
  }
  const whereClause = and(...filters)

  try {
    const rows = await db
      .select({
        id: payments.id,
        internshipId: payments.internshipId,
        internshipName: internships.name,
        demandName: employeeDemand.name,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        createdAt: payments.createdAt,
        paidAt: payments.paidAt,
        razorpayOrderId: payments.razorpayOrderId,
        razorpayPaymentId: payments.razorpayPaymentId,
        failureReason: payments.failureReason,
      })
      .from(payments)
      .innerJoin(internships, eq(payments.internshipId, internships.id))
      .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
      .where(whereClause)
      .orderBy(desc(payments.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset)

    const totalResult = await db
      .select({ value: count() })
      .from(payments)
      .where(whereClause)

    const total = Number(totalResult[0]?.value ?? 0)
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const data: PaymentRow[] = rows.map((r) => ({
      id: r.id,
      internshipId: r.internshipId,
      internshipName: r.internshipName,
      demandName: r.demandName,
      amount: Number(r.amount ?? 0),
      currency: r.currency,
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString(),
      paidAt: r.paidAt ? new Date(r.paidAt).toISOString() : null,
      razorpayOrderId: r.razorpayOrderId,
      razorpayPaymentId: r.razorpayPaymentId,
      failureReason: r.failureReason,
    }))

    return { data, page: safePage, totalPages, total }
  } catch (error) {
    console.error('[payments] getMyPaymentsPaginated error:', error)
    return { data: [], page: 1, totalPages: 1, total: 0 }
  }
}

/* -------------------------------------------------------------------------- */
/*  Stats                                                                      */
/* -------------------------------------------------------------------------- */

export async function getMyPaymentStats(): Promise<PaymentStats> {
  const empty: PaymentStats = {
    totalSpent: 0,
    paidCount: 0,
    pendingCount: 0,
    failedCount: 0,
  }

  const userId = await currentUserId()
  if (!userId) return empty

  try {
    const rows = await db
      .select({
        status: payments.status,
        total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
        cnt: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(eq(payments.userId, userId))
      .groupBy(payments.status)

    let totalSpent = 0
    let paidCount = 0
    let pendingCount = 0
    let failedCount = 0

    for (const row of rows) {
      const count = Number(row.cnt ?? 0)
      const total = Number(row.total ?? 0)

      if (row.status === 'paid') {
        paidCount = count
        totalSpent = total
      } else if (row.status === 'pending') {
        pendingCount = count
      } else if (row.status === 'failed') {
        failedCount = count
      }
    }

    return { totalSpent, paidCount, pendingCount, failedCount }
  } catch (error) {
    console.error('[payments] getMyPaymentStats error:', error)
    return empty
  }
}