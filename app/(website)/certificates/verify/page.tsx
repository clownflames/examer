import type { Metadata } from 'next'

import VerifyCertificateClient from './VerifyCertificateClient'

export const metadata: Metadata = {
  title: 'Verify Certificate | InternBird',
  description: 'Check if an InternBird certificate is genuine and valid',
}

export default async function VerifyCertificatePage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string }>
}) {
  const { no } = await searchParams

  // Server se padh rahe hain — useSearchParams() static page par Suspense
  // boundary ko permanently pending chhod deta tha
  return <VerifyCertificateClient initialNo={no ?? ''} />
}