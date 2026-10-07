'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  user,
  profile,
  payments,
  exams,
  examSubmission,
  teamMember,
  internshipRegistration,
  internships,
} from '@/db/schema'
import { auth } from '@/lib/auth'
import { PAGE_SIZE, type UserRow, type UserDetail } from './constants'

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getUsers(page = 1): Promise<{
  data: UserRow[]
  page: number
  totalPages: number
  total: number
}> {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const offset = (safePage - 1) * PAGE_SIZE

  const registrationsCount = sql<number>`(
    select count(*)::int from ${internshipRegistration}
    where ${internshipRegistration.userId} = ${user.id}
  )`

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      totalRegistrations: registrationsCount.as('total_registrations'),
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset)

  const totalResult = await db.select({ value: count() }).from(user)

  const total = Number(totalResult[0]?.value ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return {
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      emailVerified: r.emailVerified,
      image: r.image,
      role: r.role as 'user' | 'admin',
      createdAt: r.createdAt,
      totalRegistrations: Number(r.totalRegistrations ?? 0),
    })),
    page: safePage,
    totalPages,
    total,
  }
}

/* -------------------------------------------------------------------------- */
/*  Single user — everything the detail drawer needs                           */
/* -------------------------------------------------------------------------- */

/**
 * Full profile + activity for one user, fetched when a table row is opened.
 *
 * Registrations and payments are read as three separate queries and stitched
 * in JS rather than one wide join, because a registration can have several
 * payment attempts and a naive join would multiply the registration rows.
 */
export async function getUserDetail(id: string): Promise<UserDetail | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return null
    if ((session.user as { role?: string }).role !== 'admin') return null

    const [row] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1)

    if (!row) return null

    const [prof] = await db.select().from(profile).where(eq(profile.userId, id)).limit(1)

    // Each internship this student touched, plus how many exams it has.
    const regRows = await db
      .select({
        id: internshipRegistration.id,
        internshipId: internshipRegistration.internshipId,
        internshipName: internships.name,
        createdAt: internshipRegistration.createdAt,
        gainScore: internshipRegistration.gainScore,
        resumeUrl: internshipRegistration.resumeUrl,
      })
      .from(internshipRegistration)
      .innerJoin(internships, eq(internshipRegistration.internshipId, internships.id))
      .where(eq(internshipRegistration.userId, id))
      .orderBy(desc(internshipRegistration.createdAt))

    // All payment attempts, grouped by the registration they belong to.
    const payRows = await db
      .select({
        registrationId: payments.registrationId,
        status: payments.status,
        amount: payments.amount,
        paidAt: payments.paidAt,
        failureReason: payments.failureReason,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.userId, id))
      .orderBy(desc(payments.createdAt))

    const payByReg = new Map<string, typeof payRows>()
    for (const p of payRows) {
      const list = payByReg.get(p.registrationId)
      if (list) list.push(p)
      else payByReg.set(p.registrationId, [p])
    }

    // Exam counts per internship, and how many this student submitted.
    const examRows = await db
      .select({
        id: exams.id,
        internshipId: exams.internshipId,
        submitted: sql<number>`(
          select count(*)::int from ${examSubmission}
          where ${examSubmission.examId} = ${exams.id}
            and ${examSubmission.userId} = ${id}
            and ${examSubmission.submittedAt} is not null
        )`,
      })
      .from(exams)

    const examsByInternship = new Map<string, { total: number; done: number }>()
    for (const e of examRows) {
      const cur = examsByInternship.get(e.internshipId) ?? { total: 0, done: 0 }
      cur.total += 1
      cur.done += Number(e.submitted ?? 0)
      examsByInternship.set(e.internshipId, cur)
    }

    let paidCount = 0
    let unpaidCount = 0
    let paidTotal = 0

    const registrations = regRows.map((r) => {
      const attempts = payByReg.get(r.id) ?? []
      const paid = attempts.find((a) => a.status === 'paid') ?? null
      const latest = attempts[0] ?? null

      const paymentStatus = paid
        ? ('paid' as const)
        : latest?.status === 'pending'
          ? ('pending' as const)
          : latest?.status === 'failed'
            ? ('failed' as const)
            : ('unpaid' as const)

      if (paid) {
        paidCount += 1
        paidTotal += Number(paid.amount ?? 0)
      } else {
        unpaidCount += 1
      }

      const ex = examsByInternship.get(r.internshipId) ?? { total: 0, done: 0 }

      return {
        id: r.id,
        internshipId: r.internshipId,
        internshipName: r.internshipName,
        registeredAt: r.createdAt,
        gainScore: Number(r.gainScore ?? 0),
        paymentStatus,
        amountPaid: paid?.amount ?? null,
        paidAt: paid?.paidAt ?? null,
        failureReason: paymentStatus === 'paid' ? null : (latest?.failureReason ?? null),
        examsCompleted: ex.done,
        examsTotal: ex.total,
      }
    })

    const [examSubmissions] = await db
      .select({ value: count() })
      .from(examSubmission)
      .where(eq(examSubmission.userId, id))

    const [teams] = await db
      .select({ value: count() })
      .from(teamMember)
      .where(eq(teamMember.userId, id))

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      image: row.image,
      role: row.role as 'user' | 'admin',
      createdAt: row.createdAt,
      profileCompletion: prof?.profileCompletion ?? 0,

      headline: prof?.headline ?? null,
      bio: prof?.bio ?? null,
      phone: prof?.phone ?? null,
      collegeName: prof?.collegeName ?? null,
      universityName: prof?.universityName ?? null,
      degree: prof?.degree ?? null,
      branch: prof?.branch ?? null,
      rollNumber: prof?.rollNumber ?? null,
      graduationYear: prof?.graduationYear ?? null,
      cgpa: prof?.cgpa ?? null,
      city: prof?.city ?? null,
      state: prof?.state ?? null,
      country: prof?.country ?? null,
      pincode: prof?.pincode ?? null,
      githubUrl: prof?.githubUrl ?? null,
      linkedinUrl: prof?.linkedinUrl ?? null,
      portfolioUrl: prof?.portfolioUrl ?? null,
      twitterUrl: prof?.twitterUrl ?? null,
      skills: prof?.skills ?? [],
      languages: prof?.languages ?? [],
      experience: prof?.experience ?? [],
      projects: prof?.projects ?? [],
      achievements: prof?.achievements ?? [],
      // The stored key is deliberately NOT returned — only the display name.
      resumeFileName: prof?.resumeFileName ?? null,
      resumeSize: prof?.resumeSize ?? null,
      resumeUploadedAt: prof?.updatedAt ?? null,

      totalRegistrations: registrations.length,
      paidCount,
      unpaidCount,
      totalPaidAmount: paidCount > 0 ? paidTotal.toFixed(2) : null,
      examSubmissions: Number(examSubmissions?.value ?? 0),
      teams: Number(teams?.value ?? 0),
      registrations,
    }
  } catch (error) {
    console.error('getUserDetail failed:', error)
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Create via Better Auth                                                     */
/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(80),
  email: z.string().email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be at most 72 characters.'),
  role: z.enum(['user', 'admin']),
})

export type CreateUserInput = z.infer<typeof createSchema>

export async function createUser(input: CreateUserInput) {
  try {
    const parsed = createSchema.parse(input)

    // Duplicate email check for a cleaner message
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, parsed.email))
      .limit(1)

    if (existing.length > 0) {
      return {
        success: false as const,
        error: 'An account with this email already exists.',
      }
    }

    const result = await auth.api.signUpEmail({
      body: {
        name: parsed.name,
        email: parsed.email,
        password: parsed.password,
        // role is passed through if Better Auth is configured with
        // `user.additionalFields.role` (see notes below)
        role: parsed.role,
      },
    })

    if (!result) {
      return { success: false as const, error: 'Failed to create user.' }
    }

    // If Better Auth doesn't persist role via signUpEmail's body, force it here.
    // This is a safety net and idempotent when role was already applied.
    await db
      .update(user)
      .set({ role: parsed.role })
      .where(eq(user.email, parsed.email))

    revalidatePath('/admin/users')
    return { success: true as const, id: result.user?.id }
  } catch (err) {
    console.error('createUser failed:', err)
    const message =
      err instanceof Error ? err.message : 'Failed to create user.'
    return { success: false as const, error: message }
  }
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteUser(id: string, currentUserId: string) {
  try {
    if (id === currentUserId) {
      return {
        success: false as const,
        error: 'You cannot delete your own account.',
      }
    }

    const deleted = await db
      .delete(user)
      .where(eq(user.id, id))
      .returning({ id: user.id })

    if (deleted.length === 0) {
      return { success: false as const, error: 'User not found.' }
    }

    revalidatePath('/admin/users')
    return { success: true as const }
  } catch (err) {
    console.error('deleteUser failed:', err)
    return { success: false as const, error: 'Failed to delete user.' }
  }
}