'use server'

import { db } from '@/db'
import { user } from '@/db/schema'
import { auth } from '@/lib/auth'
import { eq } from 'drizzle-orm'

export async function IsAdminPresent() {
  const existing = await db
    .select()
    .from(user)
    .where(eq(user.role, 'admin'))
    .limit(1)

  return existing.length > 0
}

export async function AddAdmin({
  name,
  email,
  password,
}: {
  name: string
  email: string
  password: string
}) {
  if (await IsAdminPresent()) {
    return 'Admin Already Present in Database'
  }

  try {
    const added = await auth.api.signUpEmail({
      body: { name, email, password, role: 'admin' },
    })

    if (added) {
      return 'User Created Successfully'
    }
    return 'Server Error'
  } catch (err) {
    console.error('AddAdmin failed:', err)
    return 'Server Error'
  }
}