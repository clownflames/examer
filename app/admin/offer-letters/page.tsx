import { FileSignature } from 'lucide-react'

import {
  getInternshipOptions,
  getOfferLetters,
  getUsers,
} from './actions'
import { PAGE_SIZE, type OfferLetterFilter } from './constants'
import { OfferLettersTable } from './offer-letters-table'

export const metadata = {
  title: 'Offer Letters | Admin',
  description: 'Create and manage internship offer letters.',
}

export default async function OfferLettersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const filter: OfferLetterFilter =
    params.filter === 'draft' ||
    params.filter === 'issued' ||
    params.filter === 'accepted' ||
    params.filter === 'declined' ||
    params.filter === 'revoked'
      ? params.filter
      : 'all'

  const [{ data, totalPages, total }, users, internships] = await Promise.all([
    getOfferLetters(page, filter),
    getUsers(),
    getInternshipOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileSignature className="h-6 w-6 text-primary" />
          Offer Letters
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Issue offer letters to candidates. Drafts stay hidden until youissue
          them, and every letter gets a public reference code.
        </p>
      </div>

      <OfferLettersTable
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