'use server'

import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { headers } from 'next/headers'

import { db } from '@/db'
import {
  payments,
  internships,
  employeeDemand,
  user,
  internshipRegistration,
} from '@/db/schema'
import { auth } from '@/lib/auth'

import {
  PAGE_SIZE,
  type AdminPaymentRow,
  type AdminPaymentStats,
  type AdminPaymentDetail,
  type PaymentFilterStatus,
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
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getAdminPayments(
  page = 1,
  status: PaymentFilterStatus = 'all',
  query = ''
): Promise<{
  data: AdminPaymentRow[]
  page: number
  totalPages: number
  total: number
}> {
  await requireAdmin()

  const safePage = Math.max(1, Math.floor(page) || 1)
  const offset = (safePage - 1) * PAGE_SIZE
  const q = query.trim()

  const filters: SQL[] = []
  if (status !== 'all') {
    filters.push(eq(payments.status, status))
  }

  if (q) {
    const pattern = `%${q}%`
    const searchFilter = or(
      ilike(user.name, pattern),
      ilike(user.email, pattern),
      ilike(internships.name, pattern),
      ilike(employeeDemand.name, pattern),
      ilike(payments.razorpayOrderId, pattern),
      ilike(payments.razorpayPaymentId, pattern),
      ilike(payments.id, pattern)
    )
    if (searchFilter) filters.push(searchFilter)
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined

  try {
    const rows = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
        internshipId: payments.internshipId,
        internshipName: internships.name,
        demandName: employeeDemand.name,
        registrationId: payments.registrationId,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        razorpayOrderId: payments.razorpayOrderId,
        razorpayPaymentId: payments.razorpayPaymentId,
        createdAt: payments.createdAt,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .innerJoin(user, eq(payments.userId, user.id))
      .innerJoin(internships, eq(payments.internshipId, internships.id))
      .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
      .where(whereClause)
      .orderBy(desc(payments.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset)

    const totalResult = await db
      .select({ value: count() })
      .from(payments)
      .innerJoin(user, eq(payments.userId, user.id))
      .innerJoin(internships, eq(payments.internshipId, internships.id))
      .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
      .where(whereClause)

    const total = Number(totalResult[0]?.value ?? 0)
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const data: AdminPaymentRow[] = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      userImage: r.userImage,
      internshipId: r.internshipId,
      internshipName: r.internshipName,
      demandName: r.demandName,
      registrationId: r.registrationId,
      amount: Number(r.amount ?? 0),
      currency: r.currency,
      status: r.status,
      razorpayOrderId: r.razorpayOrderId,
      razorpayPaymentId: r.razorpayPaymentId,
      createdAt: new Date(r.createdAt).toISOString(),
      paidAt: r.paidAt ? new Date(r.paidAt).toISOString() : null,
    }))

    return { data, page: safePage, totalPages, total }
  } catch (error) {
    console.error('[admin/payments] getAdminPayments error:', error)
    return { data: [], page: 1, totalPages: 1, total: 0 }
  }
}

/* -------------------------------------------------------------------------- */
/*  Stats                                                                      */
/* -------------------------------------------------------------------------- */

export async function getAdminPaymentStats(): Promise<AdminPaymentStats> {
  const empty: AdminPaymentStats = {
    totalRevenue: 0,
    paidCount: 0,
    pendingCount: 0,
    failedCount: 0,
    uniqueStudents: 0,
  }

  try {
    await requireAdmin()

    const statusRows = await db
      .select({
        status: payments.status,
        total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
        cnt: sql<number>`count(*)::int`,
      })
      .from(payments)
      .groupBy(payments.status)

    let totalRevenue = 0
    let paidCount = 0
    let pendingCount = 0
    let failedCount = 0

    for (const row of statusRows) {
      const cnt = Number(row.cnt ?? 0)
      const total = Number(row.total ?? 0)
      if (row.status === 'paid') {
        paidCount = cnt
        totalRevenue = total
      } else if (row.status === 'pending') {
        pendingCount = cnt
      } else if (row.status === 'failed') {
        failedCount = cnt
      }
    }

    const studentsResult = await db
      .select({
        value: sql<number>`count(distinct ${payments.userId})::int`,
      })
      .from(payments)
      .where(eq(payments.status, 'paid'))

    const uniqueStudents = Number(studentsResult[0]?.value ?? 0)

    return {
      totalRevenue,
      paidCount,
      pendingCount,
      failedCount,
      uniqueStudents,
    }
  } catch (error) {
    console.error('[admin/payments] getAdminPaymentStats error:', error)
    return empty
  }
}

/* -------------------------------------------------------------------------- */
/*  Detail (drawer)                                                            */
/* -------------------------------------------------------------------------- */

export async function getAdminPaymentDetail(
  paymentId: string
): Promise<AdminPaymentDetail | null> {
  try {
    await requireAdmin()

    const [row] = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
        userRole: user.role,
        userCreatedAt: user.createdAt,
        internshipId: payments.internshipId,
        internshipName: internships.name,
        demandName: employeeDemand.name,
        registrationId: payments.registrationId,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        razorpayOrderId: payments.razorpayOrderId,
        razorpayPaymentId: payments.razorpayPaymentId,
        razorpaySignature: payments.razorpaySignature,
        failureReason: payments.failureReason,
        createdAt: payments.createdAt,
        paidAt: payments.paidAt,
        updatedAt: payments.updatedAt,
      })
      .from(payments)
      .innerJoin(user, eq(payments.userId, user.id))
      .innerJoin(internships, eq(payments.internshipId, internships.id))
      .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
      .where(eq(payments.id, paymentId))
      .limit(1)

    if (!row) return null

    const [reg] = await db
      .select({
        coverLetter: internshipRegistration.coverLetter,
        resumeUrl: internshipRegistration.resumeUrl,
      })
      .from(internshipRegistration)
      .where(eq(internshipRegistration.id, row.registrationId))
      .limit(1)

    return {
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      userEmail: row.userEmail,
      userImage: row.userImage,
      userRole: row.userRole,
      userCreatedAt: row.userCreatedAt
        ? new Date(row.userCreatedAt).toISOString()
        : null,
      internshipId: row.internshipId,
      internshipName: row.internshipName,
      demandName: row.demandName,
      registrationId: row.registrationId,
      amount: Number(row.amount ?? 0),
      currency: row.currency,
      status: row.status,
      razorpayOrderId: row.razorpayOrderId,
      razorpayPaymentId: row.razorpayPaymentId,
      razorpaySignature: row.razorpaySignature,
      failureReason: row.failureReason,
      createdAt: new Date(row.createdAt).toISOString(),
      paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
      updatedAt: new Date(row.updatedAt).toISOString(),
      coverLetter: reg?.coverLetter ?? null,
      resumeUrl: reg?.resumeUrl ?? null,
    }
  } catch (error) {
    console.error('[admin/payments] getAdminPaymentDetail error:', error)
    return null
  }
}