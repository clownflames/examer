import type { Metadata } from 'next'

import VerifyOfferLetterClient from './VerifyOfferLetterClient'

export const metadata: Metadata = {
  title: 'Verify Offer Letter | InternBird',
  description: 'Check if an InternBird offer letter is genuine and open',
}

export default async function VerifyOfferLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string }>
}) {
  const { no } = await searchParams

  // Server se padh rahe hain — useSearchParams() static page par Suspense
  // boundary ko permanently pending chhod deta tha
  return <VerifyOfferLetterClient initialNo={no ?? ''} />
}