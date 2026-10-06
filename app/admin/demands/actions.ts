'use server'

import { revalidatePath } from 'next/cache'
import { count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { CACHE_TAGS, invalidateTag } from '@/lib/cache'
import { employeeDemand, internships, team } from '@/db/schema'
import {
  PAGE_SIZE,
  demandFormSchema,
  type DemandRow,
  type DemandInput,
} from './constants'

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getDemands(page = 1): Promise<{
  data: DemandRow[]
  page: number
  totalPages: number
  total: number
}> {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const offset = (safePage - 1) * PAGE_SIZE

  const internshipsCount = sql<number>`(
    select count(*)::int from ${internships}
    where ${internships.demandId} = ${employeeDemand.id}
  )`

  const teamsCount = sql<number>`(
    select count(*)::int from ${team}
    where ${team.demandId} = ${employeeDemand.id}
  )`

  const rows = await db
    .select({
      id: employeeDemand.id,
      name: employeeDemand.name,
      iconUrl: employeeDemand.iconUrl,
      description: employeeDemand.description,
      keyFeatures: employeeDemand.keyFeatures,
      totalInternships: internshipsCount.as('total_internships'),
      totalTeams: teamsCount.as('total_teams'),
    })
    .from(employeeDemand)
    .orderBy(desc(employeeDemand.name))
    .limit(PAGE_SIZE)
    .offset(offset)

  const totalResult = await db
    .select({ value: count() })
    .from(employeeDemand)

  const total = Number(totalResult[0]?.value ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return {
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      iconUrl: r.iconUrl,
      description: r.description,
      keyFeatures: Array.isArray(r.keyFeatures)
        ? (r.keyFeatures as string[])
        : null,
      totalInternships: Number(r.totalInternships ?? 0),
      totalTeams: Number(r.totalTeams ?? 0),
      createdAt: null,
    })),
    page: safePage,
    totalPages,
    total,
  }
}

/* -------------------------------------------------------------------------- */
/*  Lightweight list (for dropdowns elsewhere)                                 */
/* -------------------------------------------------------------------------- */

export async function getDemandOptions() {
  return db
    .select({ id: employeeDemand.id, name: employeeDemand.name })
    .from(employeeDemand)
    .orderBy(employeeDemand.name)
}

/* -------------------------------------------------------------------------- */
/*  Create                                                                     */
/* -------------------------------------------------------------------------- */

function normalize(input: DemandInput) {
  return {
    name: input.name,
    iconUrl: input.iconUrl || null,
    description: input.description || null,
    keyFeatures:
      input.keyFeatures && input.keyFeatures.length > 0
        ? input.keyFeatures
        : null,
  }
}

export async function createDemand(input: DemandInput) {
  try {
    const parsed = demandFormSchema.parse(input)

    const created = await db
      .insert(employeeDemand)
      .values({
        id: crypto.randomUUID(),
        ...normalize(parsed),
      })
      .returning({ id: employeeDemand.id })

    revalidatePath('/admin/demands')
    // The homepage shows featured demands with their internship counts.
    await invalidateTag(CACHE_TAGS.demands)
    await invalidateTag(CACHE_TAGS.stats)
    return { success: true as const, id: created[0].id }
  } catch (err) {
    console.error('createDemand failed:', err)
    return { success: false as const, error: 'Failed to create demand.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Update / Delete (for completeness)                                         */
/* -------------------------------------------------------------------------- */

export async function updateDemand(id: string, input: DemandInput) {
  try {
    const parsed = demandFormSchema.parse(input)

    const updated = await db
      .update(employeeDemand)
      .set(normalize(parsed))
      .where(eq(employeeDemand.id, id))
      .returning({ id: employeeDemand.id })

    if (updated.length === 0) {
      return { success: false as const, error: 'Demand not found.' }
    }

    revalidatePath('/admin/demands')
    await invalidateTag(CACHE_TAGS.demands)
    await invalidateTag(CACHE_TAGS.stats)
    return { success: true as const }
  } catch (err) {
    console.error('updateDemand failed:', err)
    return { success: false as const, error: 'Failed to update demand.' }
  }
}

export async function deleteDemand(id: string) {
  try {
    // employeeDemand FKs are onDelete: "restrict" for internships and teams,
    // so deleting a demand that's in use will throw. Handle it gracefully.
    const deleted = await db
      .delete(employeeDemand)
      .where(eq(employeeDemand.id, id))
      .returning({ id: employeeDemand.id })

    if (deleted.length === 0) {
      return { success: false as const, error: 'Demand not found.' }
    }

    revalidatePath('/admin/demands')
    await invalidateTag(CACHE_TAGS.demands)
    await invalidateTag(CACHE_TAGS.stats)
    return { success: true as const }
  } catch (err) {
    console.error('deleteDemand failed:', err)
    return {
      success: false as const,
      error:
        'Cannot delete — this demand is used by one or more internships or teams.',
    }
  }
}