import { Award } from 'lucide-react'

import { getCertificates, getInternshipOptions, getUsers } from './actions'
import { PAGE_SIZE, type CertificateFilter } from './constants'
import { CertificatesTable } from './certificates-table'

export const metadata = {
  title: 'Certificates | Admin',
  description: 'Issue and manage user certificates.',
}

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const filter: CertificateFilter =
    params.filter === 'issued' || params.filter === 'revoked'
      ? params.filter
      : 'all'

  const [{ data, totalPages, total }, users, internships] = await Promise.all([
    getCertificates(page, filter),
    getUsers(),
    getInternshipOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Award className="h-6 w-6 text-primary" />
          Certificates
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Issue certificates to users. Every certificate gets a unique code
          that can be verified publicly.
        </p>
      </div>

      <CertificatesTable
        data={data}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        users={users}
        internships={internships}
      />
    </div>
  )
}