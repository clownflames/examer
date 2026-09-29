'use server'

import { revalidatePath } from 'next/cache'
import { asc, count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { exams, examQuestions, internships } from '@/db/schema'
import {
  PAGE_SIZE,
  examFormSchema,
  type ExamRow,
  type ExamInput,
  type InternshipOption,
} from './constants'

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

export async function createExam(input: ExamInput) {
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

    const created = await db
      .insert(exams)
      .values({
        id: crypto.randomUUID(),
        ...normalize(parsed),
      })
      .returning({ id: exams.id })

    revalidatePath('/admin/exams')
    return { success: true as const, id: created[0].id }
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