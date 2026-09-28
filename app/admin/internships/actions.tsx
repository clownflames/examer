'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  internships,
  internshipRegistration,
  employeeDemand,
} from '@/db/schema'
import {
  PAGE_SIZE,
  type InternshipRow,
  type InternshipDetail,
  internshipFormSchema,
} from './constants'

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getInternships(page = 1): Promise<{
  data: InternshipRow[]
  page: number
  totalPages: number
  total: number
}> {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const offset = (safePage - 1) * PAGE_SIZE

  const registrationsCount = sql<number>`(
    select count(*)::int
    from ${internshipRegistration}
    where ${internshipRegistration.internshipId} = ${internships.id}
  )`

  const rows = await db
    .select({
      id: internships.id,
      name: internships.name,
      demandId: internships.demandId,
      demandName: employeeDemand.name,
      createdAt: internships.createdAt,
      totalRegistrations: registrationsCount.as('total_registrations'),
    })
    .from(internships)
    .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
    .orderBy(desc(internships.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset)

  const totalResult = await db
    .select({ value: count() })
    .from(internships)

  const total = Number(totalResult[0]?.value ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return {
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      demandId: r.demandId,
      demandName: r.demandName,
      createdAt: r.createdAt,
      totalRegistrations: Number(r.totalRegistrations ?? 0),
    })),
    page: safePage,
    totalPages,
    total,
  }
}

/* -------------------------------------------------------------------------- */
/*  Single                                                                     */
/* -------------------------------------------------------------------------- */

export async function getInternshipById(
  id: string
): Promise<InternshipDetail | null> {
  const rows = await db
    .select({
      id: internships.id,
      name: internships.name,
      demandId: internships.demandId,
      description: internships.description,
      lastSubmissionDate: internships.lastSubmissionDate,
      startDate: internships.startDate,
      endDate: internships.endDate,
      jdUrl: internships.jdUrl,
      price: internships.price,
      sellingPrice: internships.sellingPrice,
      examinerName: internships.examinerName,
      examinerPhotoUrl: internships.examinerPhotoUrl,
      totalScore: internships.totalScore,
      createdAt: internships.createdAt,
      updatedAt: internships.updatedAt,
    })
    .from(internships)
    .where(eq(internships.id, id))
    .limit(1)

  return rows[0] ?? null
}

/* -------------------------------------------------------------------------- */
/*  Create / Update / Delete                                                   */
/* -------------------------------------------------------------------------- */

const internshipSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(120),
  demandId: z.string().min(1, 'Please select a demand.'),
  description: z.string().max(2000).optional().nullable(),
  lastSubmissionDate: z.coerce.date().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  jdUrl: z.string().url().optional().nullable().or(z.literal('')),
  price: z.coerce.number().nonnegative().optional().nullable(),
  sellingPrice: z.coerce.number().nonnegative().optional().nullable(),
  examinerName: z.string().max(120).optional().nullable(),
  examinerPhotoUrl: z.string().url().optional().nullable().or(z.literal('')),
  totalScore: z.coerce.number().int().positive().default(100),
})

type InternshipInput = z.infer<typeof internshipSchema>

function normalize(input: InternshipInput) {
  return {
    name: input.name,
    demandId: input.demandId,
    description: input.description || null,
    lastSubmissionDate: input.lastSubmissionDate ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    jdUrl: input.jdUrl || null,
    price: input.price != null ? String(input.price) : null,
    sellingPrice:
      input.sellingPrice != null ? String(input.sellingPrice) : null,
    examinerName: input.examinerName || null,
    examinerPhotoUrl: input.examinerPhotoUrl || null,
    totalScore: input.totalScore,
  }
}

export async function createInternship(input: InternshipInput) {
  try {
    const parsed = internshipFormSchema.parse(input)

    const created = await db
      .insert(internships)
      .values({
        id: crypto.randomUUID(),
        ...normalize(parsed),
      })
      .returning({ id: internships.id })

    revalidatePath('/admin/internships')
    return { success: true as const, id: created[0].id }
  } catch (err) {
    console.error('createInternship failed:', err)
    return { success: false as const, error: 'Failed to create internship.' }
  }
}

export async function updateInternship(id: string, input: InternshipInput) {
  try {
    const parsed = internshipFormSchema.parse(input)

    const updated = await db
      .update(internships)
      .set(normalize(parsed))
      .where(eq(internships.id, id))
      .returning({ id: internships.id })

    if (updated.length === 0) {
      return { success: false as const, error: 'Internship not found.' }
    }

    revalidatePath('/admin/internships')
    revalidatePath(`/admin/internships/${id}/edit`)
    return { success: true as const }
  } catch (err) {
    console.error('updateInternship failed:', err)
    return { success: false as const, error: 'Failed to update internship.' }
  }
}


export async function deleteInternship(id: string) {
  try {
    const deleted = await db
      .delete(internships)
      .where(eq(internships.id, id))
      .returning({ id: internships.id })

    if (deleted.length === 0) {
      return { success: false as const, error: 'Internship not found.' }
    }

    revalidatePath('/admin/internships')
    return { success: true as const }
  } catch (err) {
    console.error('deleteInternship failed:', err)
    return { success: false as const, error: 'Failed to delete internship.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Demands (for the form dropdown)                                            */
/* -------------------------------------------------------------------------- */

export async function getDemands() {
  return db
    .select({ id: employeeDemand.id, name: employeeDemand.name })
    .from(employeeDemand)
    .orderBy(employeeDemand.name)
}