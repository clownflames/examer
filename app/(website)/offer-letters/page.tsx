import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

import { auth } from '@/lib/auth'
import { getMyOfferLetters } from './actions'
import OfferLettersClient from './OfferLettersClient'

export const metadata: Metadata = {
  title: 'Offer Letters | InternBird',
  description: 'View and respond to your internship offer letters',
}

export default async function OfferLettersPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const letters = await getMyOfferLetters()

  return <OfferLettersClient userName={session.user.name} letters={letters} />
}