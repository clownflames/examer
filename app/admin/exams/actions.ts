'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { asc, count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { exams, examQuestions, internships } from '@/db/schema'
import { auth } from '@/lib/auth'
import { LIMITS, rateLimit } from '@/lib/rate-limit'
import {
  PAGE_SIZE,
  examFormSchema,
  type ExamRow,
  type ExamInput,
  type InternshipOption,
} from './constants'
import {
  countPendingDeliveryChecks,
  getNotificationCountsByExam,
  getNotificationSummary,
  getNotificationsForExam,
  notifyStudentsOfExam,
  syncDeliveryStatuses,
  type ExamNotificationCounts,
  type NotificationRow,
  type NotificationSummary,
} from './notify'

/* -------------------------------------------------------------------------- */
/*  Admin guard                                                                */
/* -------------------------------------------------------------------------- */

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  if ((session.user as { role?: string }).role !== 'admin') {
    throw new Error('Forbidden')
  }
  return session.user
}

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getExams(page = 1): Promise<{
  data: ExamRow[]
  page: number
  totalPages: number
  total: number
}> {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const offset = (safePage - 1) * PAGE_SIZE

  const questionCount = sql<number>`(
    select count(*)::int from ${examQuestions}
    where ${examQuestions.examId} = ${exams.id}
  )`

  const rows = await db
    .select({
      id: exams.id,
      name: exams.name,
      internshipId: exams.internshipId,
      internshipName: internships.name,
      orderNo: exams.orderNo,
      duration: exams.duration,
      totalMarks: exams.totalMarks,
      passingMarks: exams.passingMarks,
      isPublic: exams.isPublic,
      createdAt: exams.createdAt,
      questionCount: questionCount.as('question_count'),
    })
    .from(exams)
    .innerJoin(internships, eq(exams.internshipId, internships.id))
    .orderBy(desc(exams.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset)

  const totalResult = await db.select({ value: count() }).from(exams)

  const total = Number(totalResult[0]?.value ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return {
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      internshipId: r.internshipId,
      internshipName: r.internshipName,
      orderNo: Number(r.orderNo),
      duration: Number(r.duration),
      totalMarks: Number(r.totalMarks),
      passingMarks: r.passingMarks != null ? Number(r.passingMarks) : null,
      questionCount: Number(r.questionCount ?? 0),
      isPublic: r.isPublic,
      createdAt: r.createdAt,
    })),
    page: safePage,
    totalPages,
    total,
  }
}

/* -------------------------------------------------------------------------- */
/*  Single                                                                     */
/* -------------------------------------------------------------------------- */

export async function getExamById(id: string) {
  const rows = await db
    .select({
      id: exams.id,
      internshipId: exams.internshipId,
      orderNo: exams.orderNo,
      name: exams.name,
      description: exams.description,
      duration: exams.duration,
      totalMarks: exams.totalMarks,
      passingMarks: exams.passingMarks,
      isPublic: exams.isPublic,
    })
    .from(exams)
    .where(eq(exams.id, id))
    .limit(1)

  return rows[0] ?? null
}

/* -------------------------------------------------------------------------- */
/*  Create                                                                     */
/* -------------------------------------------------------------------------- */

function normalize(input: ExamInput) {
  return {
    internshipId: input.internshipId,
    orderNo: input.orderNo,
    name: input.name,
    description: input.description || null,
    duration: input.duration,
    totalMarks: input.totalMarks,
    passingMarks: input.passingMarks ?? null,
  }
}

export async function createExam(input: ExamInput & { notifyStudents?: boolean }) {
  try {
    await requireAdmin()

    const parsed = examFormSchema.parse(input)

    if (
      parsed.passingMarks != null &&
      parsed.passingMarks > parsed.totalMarks
    ) {
      return {
        success: false as const,
        error: 'Passing marks cannot exceed total marks.',
      }
    }

    const created = await db
      .insert(exams)
      .values({
        id: crypto.randomUUID(),
        ...normalize(parsed),
      })
      .returning({ id: exams.id })

    revalidatePath('/admin/exams')

    const id = created[0].id

    // Announce it, but never let a mail problem undo the exam itself.
    if (input.notifyStudents) {
      try {
        const internship = await db
          .select({ name: internships.name })
          .from(internships)
          .where(eq(internships.id, parsed.internshipId))
          .limit(1)

        const result = await notifyStudentsOfExam({
          examId: id,
          examName: parsed.name,
          internshipId: parsed.internshipId,
          internshipName: internship[0]?.name ?? 'your programme',
          durationMinutes: parsed.duration,
          totalMarks: parsed.totalMarks,
          passingMarks: parsed.passingMarks ?? null,
        })

        return {
          success: true as const,
          id,
          notified: {
            recipients: result.recipients,
            sent: result.sent,
            failed: result.failed,
            skipped: result.skipped,
            message: result.message,
          },
        }
      } catch (err) {
        console.error('createExam notify failed:', err)
        return {
          success: true as const,
          id,
          notified: {
            recipients: 0,
            sent: 0,
            failed: 0,
            skipped: true,
            message:
              'Exam was created, but the notification step failed. Check the Emails button to retry.',
          },
        }
      }
    }

    return { success: true as const, id }
  } catch (err) {
    console.error('createExam failed:', err)
    return { success: false as const, error: 'Failed to create exam.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateExam(id: string, input: ExamInput) {
  try {
    const parsed = examFormSchema.parse(input)

    if (
      parsed.passingMarks != null &&
      parsed.passingMarks > parsed.totalMarks
    ) {
      return {
        success: false as const,
        error: 'Passing marks cannot exceed total marks.',
      }
    }

    const updated = await db
      .update(exams)
      .set(normalize(parsed))
      .where(eq(exams.id, id))
      .returning({ id: exams.id })

    if (updated.length === 0) {
      return { success: false as const, error: 'Exam not found.' }
    }

    revalidatePath('/admin/exams')
    return { success: true as const }
  } catch (err) {
    console.error('updateExam failed:', err)
    return { success: false as const, error: 'Failed to update exam.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteExam(id: string) {
  try {
    const deleted = await db
      .delete(exams)
      .where(eq(exams.id, id))
      .returning({ id: exams.id })

    if (deleted.length === 0) {
      return { success: false as const, error: 'Exam not found.' }
    }

    revalidatePath('/admin/exams')
    return { success: true as const }
  } catch (err) {
    console.error('deleteExam failed:', err)
    return { success: false as const, error: 'Failed to delete exam.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Toggle Visibility (public / private)                                       */
/* -------------------------------------------------------------------------- */

export async function toggleExamVisibility(
  id: string,
  isPublic: boolean
): Promise<
  { success: true; isPublic: boolean } | { success: false; error: string }
> {
  try {
    const updated = await db
      .update(exams)
      .set({ isPublic })
      .where(eq(exams.id, id))
      .returning({ id: exams.id, isPublic: exams.isPublic })

    if (updated.length === 0) {
      return { success: false as const, error: 'Exam not found.' }
    }

    revalidatePath('/admin/exams')
    // user side bhi refresh ho jaye
    revalidatePath('/')
    revalidatePath('/internships')

    return { success: true as const, isPublic: updated[0].isPublic }
  } catch (err) {
    console.error('toggleExamVisibility failed:', err)
    return { success: false as const, error: 'Failed to update visibility.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Options                                                                    */
/* -------------------------------------------------------------------------- */

export async function getInternshipOptions(): Promise<InternshipOption[]> {
  return db
    .select({ id: internships.id, name: internships.name })
    .from(internships)
    .orderBy(asc(internships.name))
}

/** Suggests the next order number for a given internship. */
export async function getNextOrderNo(internshipId: string): Promise<number> {
  const rows = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${exams.orderNo}), 0)::int`,
    })
    .from(exams)
    .where(eq(exams.internshipId, internshipId))

  return Number(rows[0]?.maxOrder ?? 0) + 1
}

/* -------------------------------------------------------------------------- */
/*  Student notifications                                                      */
/* -------------------------------------------------------------------------- */

export type NotifyResult = {
  success: boolean
  recipients?: number
  sent?: number
  failed?: number
  skipped?: boolean
  error?: string
}

/** Announce an existing exam to everyone who has paid for its internship. */
export async function notifyExamStudents(
  examId: string
): Promise<NotifyResult> {
  try {
    await requireAdmin()

    /**
     * Sending is synchronous and costs real money, so it must not be
     * double-triggered by a double-click or a retried request.
     */
    const notifyLimit = await rateLimit(LIMITS.examNotify)
    if (!notifyLimit.ok) {
      return {
        success: false,
        error: `Too many notification attempts. Wait about ${
          notifyLimit.retryAfterSeconds ?? 60
        } seconds before retrying.`,
      }
    }

    const [row] = await db
      .select({
        id: exams.id,
        name: exams.name,
        internshipId: exams.internshipId,
        duration: exams.duration,
        totalMarks: exams.totalMarks,
        passingMarks: exams.passingMarks,
        internshipName: internships.name,
      })
      .from(exams)
      .leftJoin(internships, eq(exams.internshipId, internships.id))
      .where(eq(exams.id, examId))
      .limit(1)

    if (!row) return { success: false, error: 'Exam not found.' }

    const result = await notifyStudentsOfExam({
      examId: row.id,
      examName: row.name,
      internshipId: row.internshipId,
      internshipName: row.internshipName ?? 'your programme',
      durationMinutes: row.duration,
      totalMarks: row.totalMarks,
      passingMarks: row.passingMarks,
    })

    revalidatePath('/admin/exams')
    return {
      success: true,
      recipients: result.recipients,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      ...(result.message ? { error: result.message } : {}),
    }
  } catch (err) {
    console.error('notifyExamStudents failed:', err)
    return { success: false, error: 'Failed to send notifications.' }
  }
}

/**
 * Asks the provider for the real delivery status of everything still in
 * flight. Pass an examId to scope it, or omit it to sweep the whole site.
 */
export async function syncExamEmailStatuses(
  examId?: string
): Promise<
  | { success: true; checked: number; updated: number; unknown: number }
  | { success: false; error: string }
> {
  try {
    await requireAdmin()
    const result = await syncDeliveryStatuses(examId)
    revalidatePath('/admin/exams')
    return { success: true, ...result }
  } catch (err) {
    console.error('syncExamEmailStatuses failed:', err)
    return { success: false, error: 'Failed to check delivery status.' }
  }
}

export async function getExamEmailStatus(examId: string): Promise<{
  summary: NotificationSummary
  rows: NotificationRow[]
}> {
  try {
    await requireAdmin()
    const [summary, rows] = await Promise.all([
      getNotificationSummary(examId),
      getNotificationsForExam(examId),
    ])
    return { summary, rows }
  } catch (err) {
    console.error('getExamEmailStatus failed:', err)
    return {
      summary: {
        total: 0,
        delivered: 0,
        sent: 0,
        queued: 0,
        failed: 0,
        bounced: 0,
        complained: 0,
        deliveredTo: 0,
      },
      rows: [],
    }
  }
}

export async function getAllEmailNotificationCounts(): Promise<ExamNotificationCounts> {
  try {
    await requireAdmin()
    return await getNotificationCountsByExam()
  } catch (err) {
    console.error('getAllEmailNotificationCounts failed:', err)
    return {}
  }
}

export async function getPendingDeliveryCheckCount(): Promise<number> {
  try {
    await requireAdmin()
    return await countPendingDeliveryChecks()
  } catch (err) {
    console.error('getPendingDeliveryCheckCount failed:', err)
    return 0
  }
}