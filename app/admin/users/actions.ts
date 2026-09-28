'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { user, internshipRegistration } from '@/db/schema'
import { auth } from '@/lib/auth'
import { PAGE_SIZE, type UserRow } from './constants'

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