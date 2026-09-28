'use server'

import { db } from '@/db'
import { user } from '@/db/schema'
import { auth } from '@/lib/auth'
import { eq } from 'drizzle-orm'

// ... existing IsAdminPresent and AddAdmin ...

export async function AddUser({
  name,
  email,
  password,
}: {
  name: string
  email: string
  password: string
}) {
  try {
    // Prevent duplicate emails up-front for a cleaner error
    const existing = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1)

    if (existing.length > 0) {
      return 'An account with this email already exists.'
    }

    const added = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
        role: 'user',
      },
    })

    if (added) {
      return 'User Created Successfully'
    }
    return 'Server Error'
  } catch (err) {
    console.error('AddUser failed:', err)
    return 'Server Error'
  }
}


export async function GetSession() {
  const session = await auth.api.getSession({ headers: await import('next/headers').then(m => m.headers()) })
  return session
}