'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { user } from '@/db/schema'
import { auth } from '@/lib/auth'

/* -------------------------------------------------------------------------- */
/*  Get current user                                                           */
/* -------------------------------------------------------------------------- */

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  return rows[0] ?? null
}

/* -------------------------------------------------------------------------- */
/*  Update profile (name + image)                                              */
/* -------------------------------------------------------------------------- */

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(80),
  image: z
    .string()
    .url('Must be a valid URL.')
    .optional()
    .nullable()
    .or(z.literal('')),
})

export type ProfileInput = z.infer<typeof profileSchema>

export async function updateProfile(input: ProfileInput) {
  try {
    const parsed = profileSchema.parse(input)

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return { success: false as const, error: 'Not authenticated.' }
    }

    await db
      .update(user)
      .set({
        name: parsed.name,
        image: parsed.image || null,
      })
      .where(eq(user.id, session.user.id))

    revalidatePath('/admin/settings')
    return { success: true as const }
  } catch (err) {
    console.error('updateProfile failed:', err)
    return { success: false as const, error: 'Failed to update profile.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Change password                                                            */
/* -------------------------------------------------------------------------- */

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(72, 'Password must be at most 72 characters.'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'New password must be different from the current one.',
    path: ['newPassword'],
  })

export type PasswordInput = z.infer<typeof passwordSchema>

export async function changePassword(input: PasswordInput) {
  try {
    const parsed = passwordSchema.parse(input)

    // Better Auth's changePassword requires the user's session cookie
    // and handles the current-password check server-side.
    const result = await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: parsed.currentPassword,
        newPassword: parsed.newPassword,
        revokeOtherSessions: true,
      },
    })

    if (!result) {
      return { success: false as const, error: 'Failed to change password.' }
    }

    return { success: true as const }
  } catch (err) {
    console.error('changePassword failed:', err)
    const message =
      err instanceof Error ? err.message : 'Failed to change password.'
    return { success: false as const, error: message }
  }
}