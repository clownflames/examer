import { ShieldCheck } from 'lucide-react'

import {
  getVerificationCounts,
  getVerificationRequests,
} from './actions'
import { PAGE_SIZE, type VerificationFilter } from './constants'
import { VerificationRequestsTable } from './verification-requests-table'

export const metadata = {
  title: 'Verification Requests | Admin',
  description: 'Review certificate verification requests from users.',
}

export default async function VerificationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const filter: VerificationFilter =
    params.filter === 'approved' ||
    params.filter === 'rejected' ||
    params.filter === 'all'
      ? params.filter
      : 'pending'

  const [{ data, totalPages, total }, counts] = await Promise.all([
    getVerificationRequests(page, filter),
    getVerificationCounts(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Verification Requests
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Users request employers to verify their certificates. Approve or
          reject each request here.
        </p>
      </div>

      <VerificationRequestsTable
        data={data}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        counts={counts}
      />
    </div>
  )
}