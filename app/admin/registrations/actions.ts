'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { and, count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  internshipRegistration,
  internships,
  exams,
  examSubmission,
  user,
} from '@/db/schema'
import {
  PAGE_SIZE,
  type RegistrationRow,
  type StudentOption,
  type InternshipOption,
} from './constants'

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getRegistrations(page = 1): Promise<{
  data: RegistrationRow[]
  page: number
  totalPages: number
  total: number
}> {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const offset = (safePage - 1) * PAGE_SIZE

  // Total exams per internship (for the "x / y" display)
  const examsTotalSubquery = sql<number>`(
    select count(*)::int from ${exams}
    where ${exams.internshipId} = ${internshipRegistration.internshipId}
  )`

  // Exams the student has submitted for this internship
  const examsCompletedSubquery = sql<number>`(
    select count(*)::int from ${examSubmission}
    where ${examSubmission.userId} = ${internshipRegistration.userId}
      and ${examSubmission.examId} in (
        select ${exams.id} from ${exams}
        where ${exams.internshipId} = ${internshipRegistration.internshipId}
      )
      and ${examSubmission.submittedAt} is not null
  )`

  const rows = await db
    .select({
      id: internshipRegistration.id,
      userId: internshipRegistration.userId,
      studentName: user.name,
      studentEmail: user.email,
      internshipId: internshipRegistration.internshipId,
      internshipName: internships.name,
      gainScore: internshipRegistration.gainScore,
      createdAt: internshipRegistration.createdAt,
      examsCompleted: examsCompletedSubquery.as('exams_completed'),
      examsTotal: examsTotalSubquery.as('exams_total'),
    })
    .from(internshipRegistration)
    .innerJoin(user, eq(internshipRegistration.userId, user.id))
    .innerJoin(
      internships,
      eq(internshipRegistration.internshipId, internships.id)
    )
    .orderBy(desc(internshipRegistration.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset)

  const totalResult = await db
    .select({ value: count() })
    .from(internshipRegistration)

  const total = Number(totalResult[0]?.value ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return {
    data: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      internshipId: r.internshipId,
      internshipName: r.internshipName,
      gainScore: Number(r.gainScore ?? 0),
      createdAt: r.createdAt,
      examsCompleted: Number(r.examsCompleted ?? 0),
      examsTotal: Number(r.examsTotal ?? 0),
    })),
    page: safePage,
    totalPages,
    total,
  }
}

/* -------------------------------------------------------------------------- */
/*  Update gain score                                                          */
/* -------------------------------------------------------------------------- */

const gainScoreSchema = z.object({
  id: z.string().min(1),
  gainScore: z.coerce.number().int().min(0).max(1000),
})

export async function updateGainScore(input: {
  id: string
  gainScore: number
}) {
  try {
    const parsed = gainScoreSchema.parse(input)

    const updated = await db
      .update(internshipRegistration)
      .set({ gainScore: parsed.gainScore })
      .where(eq(internshipRegistration.id, parsed.id))
      .returning({ id: internshipRegistration.id })

    if (updated.length === 0) {
      return { success: false as const, error: 'Registration not found.' }
    }

    revalidatePath('/admin/registrations')
    return { success: true as const }
  } catch (err) {
    console.error('updateGainScore failed:', err)
    return { success: false as const, error: 'Failed to update score.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteRegistration(id: string) {
  try {
    const deleted = await db
      .delete(internshipRegistration)
      .where(eq(internshipRegistration.id, id))
      .returning({ id: internshipRegistration.id })

    if (deleted.length === 0) {
      return { success: false as const, error: 'Registration not found.' }
    }

    revalidatePath('/admin/registrations')
    return { success: true as const }
  } catch (err) {
    console.error('deleteRegistration failed:', err)
    return { success: false as const, error: 'Failed to delete registration.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Create                                                                     */
/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  userId: z.string().min(1, 'Please select a student.'),
  internshipId: z.string().min(1, 'Please select an internship.'),
  coverLetter: z.string().max(20_000).optional().nullable(), // was 5000
  resumeUrl: z.string().url().optional().nullable().or(z.literal('')),
  gainScore: z.coerce.number().int().min(0).max(1000).default(0),
})

export type CreateRegistrationInput = z.infer<typeof createSchema>

export async function createRegistration(input: CreateRegistrationInput) {
  try {
    const parsed = createSchema.parse(input)

    // Prevent duplicate registrations
    const existing = await db
      .select({ id: internshipRegistration.id })
      .from(internshipRegistration)
      .where(
        and(
          eq(internshipRegistration.userId, parsed.userId),
          eq(internshipRegistration.internshipId, parsed.internshipId)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return {
        success: false as const,
        error: 'This student is already registered for this internship.',
      }
    }

    const created = await db
      .insert(internshipRegistration)
      .values({
        id: crypto.randomUUID(),
        userId: parsed.userId,
        internshipId: parsed.internshipId,
        coverLetter: parsed.coverLetter || null,
        resumeUrl: parsed.resumeUrl || null,
        gainScore: parsed.gainScore,
      })
      .returning({ id: internshipRegistration.id })

    revalidatePath('/admin/registrations')
    return { success: true as const, id: created[0].id }
  } catch (err) {
    console.error('createRegistration failed:', err)
    return { success: false as const, error: 'Failed to create registration.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Options for the create drawer                                              */
/* -------------------------------------------------------------------------- */

export async function getStudentOptions(): Promise<StudentOption[]> {
  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.role, 'user'))
    .orderBy(user.name)
}

export async function getInternshipOptions(): Promise<InternshipOption[]> {
  return db
    .select({ id: internships.id, name: internships.name })
    .from(internships)
    .orderBy(internships.name)
}