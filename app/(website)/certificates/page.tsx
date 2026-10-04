import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

import { auth } from '@/lib/auth'
import { getMyCertificates, getMyVerificationRequests } from './actions'
import CertificatesClient from './CertificatesClient'

export const metadata: Metadata = {
  title: 'Certificates | InternBird',
  description: 'View and verify your certificates',
}

export default async function CertificatesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const [certificates, requests] = await Promise.all([
    getMyCertificates(),
    getMyVerificationRequests(),
  ])

  return (
    <CertificatesClient
      userName={session.user.name}
      certificates={certificates}
      requests={requests}
    />
  )
}