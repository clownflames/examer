'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { asc, count, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import { exams, examQuestions, internships, questionMcqs } from '@/db/schema'
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

/* -------------------------------------------------------------------------- */
/*  Copying an exam to other internships                                       */
/*                                                                             */
/*  Shared by `createExam` (copies made during creation) and                  */
/*  `copyExamToInternships` (copies made from the Exams table).                */
/* -------------------------------------------------------------------------- */

type QuestionTemplate = {
  name: string
  type: string
  marks: number
  details: string | null
  defaultText: string | null
  options: { labelText: string; isCorrect: boolean }[]
}

type ExamCopyRow = {
  id: string
  internshipId: string
  orderNo: number
  name: string
  description: string | null
  duration: number
  totalMarks: number
  passingMarks: number | null
  isPublic: boolean
}

/**
 * Read a question set in the order the student runner uses it, so a copy is
 * indistinguishable from its source at runtime.
 */
async function loadQuestionTemplate(
  examId: string
): Promise<QuestionTemplate[]> {
  const questions = await db
    .select({
      id: examQuestions.id,
      name: examQuestions.name,
      type: examQuestions.type,
      marks: examQuestions.marks,
      details: examQuestions.details,
      defaultText: examQuestions.defaultText,
    })
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.createdAt), asc(examQuestions.id))

  if (questions.length === 0) return []

  const options = await db
    .select({
      questionId: questionMcqs.questionId,
      labelText: questionMcqs.labelText,
      isCorrect: questionMcqs.isCorrect,
    })
    .from(questionMcqs)
    .where(
      inArray(
        questionMcqs.questionId,
        questions.map((q) => q.id)
      )
    )
    // Matches the student runner's ordering.
    .orderBy(asc(questionMcqs.labelText))

  const byQuestion = new Map<string, QuestionTemplate['options']>()
  for (const option of options) {
    const list = byQuestion.get(option.questionId) ?? []
    list.push({
      labelText: option.labelText,
      isCorrect: option.isCorrect,
    })
    byQuestion.set(option.questionId, list)
  }

  return questions.map((q) => ({
    name: q.name,
    type: q.type,
    marks: Number(q.marks),
    details: q.details,
    defaultText: q.defaultText,
    options: byQuestion.get(q.id) ?? [],
  }))
}

/**
 * Insert several exams that all share the same question set, in one transaction.
 *
 * `createdAt` is written explicitly rather than left to `defaultNow()`:
 * Postgres' `now()` is the *transaction* timestamp, so every row would share one
 * value and `ORDER BY created_at` would fall back to heap order. Nudging the
 * timestamp per exam and per question keeps the original ordering intact.
 */
async function insertExamsWithQuestions(
  examRows: ExamCopyRow[],
  template: QuestionTemplate[]
) {
  const now = Date.now()

  const examValues = examRows.map((exam, index) => ({
    ...exam,
    createdAt: new Date(now + index),
  }))

  const questionPairs: {
    row: {
      id: string
      examId: string
      name: string
      type: string
      marks: number
      details: string | null
      defaultText: string | null
      createdAt: Date
    }
    options: QuestionTemplate['options']
  }[] = []
  examRows.forEach((exam, examIndex) => {
    template.forEach((question, questionIndex) => {
      questionPairs.push({
        row: {
          id: crypto.randomUUID(),
          examId: exam.id,
          name: question.name,
          type: question.type,
          marks: question.marks,
          details: question.details,
          defaultText: question.defaultText,
          createdAt: new Date(now + examIndex * 100_000 + questionIndex),
        },
        options: question.options,
      })
    })
  })

  const questionValues = questionPairs.map((pair) => pair.row)
  const optionValues = questionPairs.flatMap((pair) =>
    pair.options
      .filter((option) => option.labelText.trim() !== '')
      .map((option) => ({
        id: crypto.randomUUID(),
        questionId: pair.row.id,
        labelText: option.labelText,
        isCorrect: option.isCorrect,
      }))
  )

  await db.transaction(async (tx) => {
    await tx.insert(exams).values(examValues)
    if (questionValues.length > 0) {
      await tx.insert(examQuestions).values(questionValues)
    }
    if (optionValues.length > 0) {
      await tx.insert(questionMcqs).values(optionValues)
    }
  })
}

/** Drop unknown ids and de-duplicate, preserving the caller's order. */
async function resolveInternshipIds(ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id))]
  if (unique.length === 0) return []

  const known = await db
    .select({ id: internships.id })
    .from(internships)
    .where(inArray(internships.id, unique))
  const knownIds = new Set(known.map((row) => row.id))
  return unique.filter((id) => knownIds.has(id))
}

export type CreateExamResult =
  | { success: false; error: string }
  | {
      success: true
      id: string
      /** How many extra exams were created for other internships. */
      copies: number
      /** Questions replicated onto every exam created in this call. */
      questionsCopied: number
      notified?: {
        recipients: number
        sent: number
        failed: number
        skipped?: boolean
        message?: string
      }
    }

export async function createExam(
  input: ExamInput & { notifyStudents?: boolean },
  extra?: {
    /** Extra internships that should get an identical copy of this exam. */
    alsoCreateFor?: string[]
    /** Copy this exam's questions into every exam created in this call. */
    copyQuestionsFromExamId?: string
  }
): Promise<CreateExamResult> {
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

    const template = extra?.copyQuestionsFromExamId
      ? await loadQuestionTemplate(extra.copyQuestionsFromExamId)
      : []

    // The primary internship's own id is never a copy target.
    const copyTargets = (
      await resolveInternshipIds(extra?.alsoCreateFor ?? [])
    ).filter((id) => id !== parsed.internshipId)

    const primary: ExamCopyRow = {
      id: crypto.randomUUID(),
      ...normalize(parsed),
      isPublic: false,
    }

    const copyRows: ExamCopyRow[] = []
    for (const internshipId of copyTargets) {
      copyRows.push({
        ...primary,
        id: crypto.randomUUID(),
        internshipId,
        orderNo: await getNextOrderNo(internshipId),
      })
    }

    await insertExamsWithQuestions([primary, ...copyRows], template)

    const id = primary.id

    revalidatePath('/admin/exams')

    const created = {
      copies: copyRows.length,
      questionsCopied: template.length,
    }

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
          ...created,
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
          ...created,
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

    return { success: true as const, id, ...created }
  } catch (err) {
    console.error('createExam failed:', err)
    return { success: false as const, error: 'Failed to create exam.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Copy an existing exam to other internships                                 */
/* -------------------------------------------------------------------------- */

export type CopyExamOptions = {
  /** Default true — copies every question and MCQ option. */
  copyQuestions?: boolean
  /** Appended to the source name, e.g. " (Java)". */
  nameSuffix?: string
  /** `next` = next free order in the target internship, `same` = keep source's. */
  orderMode?: 'next' | 'same'
  /** Copies default to private; visibility is flipped from the table. */
  makePublic?: boolean
}

export type CopyExamResult = {
  success: boolean
  created?: number
  questionsCopied?: number
  /** Targets that were dropped because they do not exist. */
  skipped?: number
  error?: string
}

export async function copyExamToInternships(
  sourceExamId: string,
  targetInternshipIds: string[],
  options: CopyExamOptions = {}
): Promise<CopyExamResult> {
  try {
    await requireAdmin()

    const source = await getExamById(sourceExamId)
    if (!source) {
      return { success: false, error: 'Source exam not found.' }
    }

    const requested = [...new Set(targetInternshipIds.filter(Boolean))]
    const targets = (
      await resolveInternshipIds(requested)
    ).filter((id) => id !== source.internshipId)

    if (targets.length === 0) {
      return {
        success: false,
        error: 'Select at least one internship other than the current one.',
      }
    }

    const suffix = options.nameSuffix?.trim() ?? ''
    const name = `${source.name}${suffix}`
    if (name.length > 120) {
      return {
        success: false,
        error: 'That name suffix pushes the exam name past 120 characters.',
      }
    }

    const template =
      options.copyQuestions === false ? [] : await loadQuestionTemplate(sourceExamId)

    const rows: ExamCopyRow[] = []
    for (const internshipId of targets) {
      rows.push({
        id: crypto.randomUUID(),
        internshipId,
        orderNo:
          options.orderMode === 'same'
            ? Number(source.orderNo)
            : await getNextOrderNo(internshipId),
        name,
        description: source.description ?? null,
        duration: Number(source.duration),
        totalMarks: Number(source.totalMarks),
        passingMarks:
          source.passingMarks == null ? null : Number(source.passingMarks),
        isPublic: options.makePublic ?? false,
      })
    }

    await insertExamsWithQuestions(rows, template)

    revalidatePath('/admin/exams')
    revalidatePath(`/admin/exams/${sourceExamId}/questions`)

    return {
      success: true,
      created: rows.length,
      questionsCopied: template.length,
      skipped: requested.length - targets.length,
    }
  } catch (err) {
    console.error('copyExamToInternships failed:', err)
    return { success: false, error: 'Failed to copy the exam.' }
  }
}

/** Compact exam list used to pick a question set to clone during creation. */
export async function getExamsForQuestionTemplate(): Promise<
  {
    id: string
    name: string
    internshipName: string
    questionCount: number
  }[]
> {
  const questionCount = sql<number>`(
    select count(*)::int from ${examQuestions}
    where ${examQuestions.examId} = ${exams.id}
  )`

  const rows = await db
    .select({
      id: exams.id,
      name: exams.name,
      internshipName: internships.name,
      questionCount: questionCount.as('question_count'),
    })
    .from(exams)
    .innerJoin(internships, eq(exams.internshipId, internships.id))
    .orderBy(desc(exams.createdAt))
    .limit(200)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    internshipName: row.internshipName,
    questionCount: Number(row.questionCount ?? 0),
  }))
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