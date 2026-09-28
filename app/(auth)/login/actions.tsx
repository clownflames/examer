'use server'

import { auth } from '@/lib/auth'

export async function SignInUser({
  email,
  password,
}: {
  email: string
  password: string
}) {
  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
    })

    if (result) {
      return { success: true }
    }
    return { success: false, error: 'Invalid email or password.' }
  } catch (err) {
    console.error('SignInUser failed:', err)
    return { success: false, error: 'Invalid email or password.' }
  }
}