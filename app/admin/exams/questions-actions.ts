'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
  exams,
  examQuestions,
  questionMcqs,
  internships,
} from '@/db/schema'
import {
  questionFormSchema,
  type QuestionRow,
  type QuestionInput,
  type QuestionType,
  type ExamInfo,
} from './questions-constants'
import { MAX_IMPORT_ROWS } from './questions-import'

/**
 * Mirrors the guard in `actions.ts`. Without it, any authenticated user could
 * call these actions directly — the admin layout redirect is UI-only.
 */
async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  if ((session.user as { role?: string }).role !== 'admin') {
    throw new Error('Forbidden')
  }
  return session.user
}

/* -------------------------------------------------------------------------- */
/*  Exam info                                                                  */
/* -------------------------------------------------------------------------- */

export async function getExamInfo(examId: string): Promise<ExamInfo | null> {
  const rows = await db
    .select({
      id: exams.id,
      name: exams.name,
      internshipId: exams.internshipId,
      internshipName: internships.name,
      totalMarks: exams.totalMarks,
    })
    .from(exams)
    .innerJoin(internships, eq(exams.internshipId, internships.id))
    .where(eq(exams.id, examId))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    internshipId: row.internshipId,
    internshipName: row.internshipName,
    totalMarks: Number(row.totalMarks),
  }
}

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getQuestionsForExam(
  examId: string
): Promise<QuestionRow[]> {
  const questions = await db
    .select({
      id: examQuestions.id,
      examId: examQuestions.examId,
      name: examQuestions.name,
      type: examQuestions.type,
      marks: examQuestions.marks,
      details: examQuestions.details,
      defaultText: examQuestions.defaultText,
      createdAt: examQuestions.createdAt,
    })
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.createdAt))

  if (questions.length === 0) return []

  const questionIds = questions.map((q) => q.id)

  const mcqs = await db
    .select({
      id: questionMcqs.id,
      questionId: questionMcqs.questionId,
      labelText: questionMcqs.labelText,
      isCorrect: questionMcqs.isCorrect,
    })
    .from(questionMcqs)
    .where(inArray(questionMcqs.questionId, questionIds))
    .orderBy(asc(questionMcqs.id))

  const byQuestion = new Map<
    string,
    { id: string; labelText: string; isCorrect: boolean }[]
  >()
  for (const m of mcqs) {
    const list = byQuestion.get(m.questionId) ?? []
    list.push({ id: m.id, labelText: m.labelText, isCorrect: m.isCorrect })
    byQuestion.set(m.questionId, list)
  }

  return questions.map((q) => ({
    id: q.id,
    examId: q.examId,
    name: q.name,
    type: q.type as QuestionType,
    marks: Number(q.marks),
    details: q.details,
    defaultText: q.defaultText,
    options: byQuestion.get(q.id) ?? [],
    createdAt: q.createdAt,
  }))
}

/* -------------------------------------------------------------------------- */
/*  Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createQuestion(examId: string, input: QuestionInput) {
  try {
    await requireAdmin()
    const parsed = questionFormSchema.parse(input)

    const questionId = crypto.randomUUID()

    await db.transaction(async (tx) => {
      await tx.insert(examQuestions).values({
        id: questionId,
        examId,
        name: parsed.name,
        type: parsed.type,
        marks: parsed.marks,
        details: parsed.details || null,
        defaultText: parsed.defaultText || null,
      })

      if (parsed.type === 'mcq' && parsed.options && parsed.options.length > 0) {
        const filled = parsed.options.filter(
          (o) => o.labelText.trim().length > 0
        )
        if (filled.length > 0) {
          await tx.insert(questionMcqs).values(
            filled.map((o) => ({
              id: crypto.randomUUID(),
              questionId,
              labelText: o.labelText,
              isCorrect: o.isCorrect,
            }))
          )
        }
      }
    })

    revalidatePath('/admin/exams')
    revalidatePath(`/admin/exams/${examId}/questions`)
    return { success: true as const, id: questionId }
  } catch (err) {
    console.error('createQuestion failed:', err)
    return { success: false as const, error: 'Failed to create question.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateQuestion(id: string, input: QuestionInput) {
  try {
    await requireAdmin()
    const parsed = questionFormSchema.parse(input)

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(examQuestions)
        .set({
          name: parsed.name,
          type: parsed.type,
          marks: parsed.marks,
          details: parsed.details || null,
          defaultText: parsed.defaultText || null,
        })
        .where(eq(examQuestions.id, id))
        .returning({ id: examQuestions.id })

      if (updated.length === 0) {
        throw new Error('Question not found.')
      }

      await tx.delete(questionMcqs).where(eq(questionMcqs.questionId, id))

      if (
        parsed.type === 'mcq' &&
        parsed.options &&
        parsed.options.length > 0
      ) {
        const filled = parsed.options.filter(
          (o) => o.labelText.trim().length > 0
        )
        if (filled.length > 0) {
          await tx.insert(questionMcqs).values(
            filled.map((o) => ({
              id: crypto.randomUUID(),
              questionId: id,
              labelText: o.labelText,
              isCorrect: o.isCorrect,
            }))
          )
        }
      }
    })

    revalidatePath('/admin/exams')
    return { success: true as const }
  } catch (err) {
    console.error('updateQuestion failed:', err)
    return { success: false as const, error: 'Failed to update question.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteQuestion(id: string) {
  try {
    await requireAdmin()
    const deleted = await db
      .delete(examQuestions)
      .where(eq(examQuestions.id, id))
      .returning({ id: examQuestions.id })

    if (deleted.length === 0) {
      return { success: false as const, error: 'Question not found.' }
    }

    revalidatePath('/admin/exams')
    return { success: true as const }
  } catch (err) {
    console.error('deleteQuestion failed:', err)
    return { success: false as const, error: 'Failed to delete question.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Bulk import                                                                 */
/* -------------------------------------------------------------------------- */

/** Server-side mirror of the client's schema, with the row count capped. */
const bulkImportSchema = z
  .array(questionFormSchema)
  .min(1, 'No valid rows to import.')
  .max(MAX_IMPORT_ROWS, `You can import at most ${MAX_IMPORT_ROWS} questions at a time.`)

export type BulkImportResult = {
  success: boolean
  imported?: number
  error?: string
}

/**
 * Insert many questions (and their MCQ options) in one transaction.
 *
 * `createdAt` is written explicitly rather than left to `defaultNow()`:
 * Postgres' `now()` is the *transaction* timestamp, so every row in a single
 * transaction would share one value and the `ORDER BY created_at` in
 * `getQuestionsForExam` would fall back to heap order. Bumping one millisecond
 * per row keeps spreadsheet order stable and appends the batch after any
 * questions added earlier.
 */
export async function importQuestions(
  examId: string,
  inputs: unknown[]
): Promise<BulkImportResult> {
  try {
    await requireAdmin()

    const parsed = bulkImportSchema.parse(inputs)
    const examExists = await db
      .select({ id: exams.id })
      .from(exams)
      .where(eq(exams.id, examId))
      .limit(1)
    if (examExists.length === 0) {
      return { success: false, error: 'Exam not found.' }
    }

    const now = Date.now()
    const questionRows = parsed.map((q, index) => ({
      id: crypto.randomUUID(),
      examId,
      name: q.name,
      type: q.type,
      marks: q.marks,
      details: q.details || null,
      defaultText: q.defaultText || null,
      createdAt: new Date(now + index),
    }))

    const optionRows = parsed.flatMap((q, index) =>
      q.type !== 'mcq' || !q.options?.length
        ? []
        : q.options
            .filter((o) => o.labelText.trim().length > 0)
            .map((o) => ({
              id: crypto.randomUUID(),
              questionId: questionRows[index].id,
              labelText: o.labelText,
              isCorrect: o.isCorrect,
            }))
    )

    await db.transaction(async (tx) => {
      await tx.insert(examQuestions).values(questionRows)
      if (optionRows.length > 0) {
        await tx.insert(questionMcqs).values(optionRows)
      }
    })

    revalidatePath('/admin/exams')
    revalidatePath(`/admin/exams/${examId}/questions`)
    return { success: true, imported: questionRows.length }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        success: false,
        error: err.issues[0]?.message ?? 'Some rows could not be imported.',
      }
    }
    const message = err instanceof Error ? err.message : ''
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return { success: false, error: 'Not allowed.' }
    }
    console.error('importQuestions failed:', err)
    return { success: false, error: 'Failed to import questions.' }
  }
}