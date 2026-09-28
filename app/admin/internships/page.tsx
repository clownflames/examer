import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getInternships } from './actions'
import { InternshipsTable } from './internships-table'

export default async function InternshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const { data, totalPages, total } = await getInternships(page)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Internships
          </h2>
          <p className="text-muted-foreground text-sm">
            Manage all internships in your workspace.
          </p>
        </div>
        <Button render={<Link href="/admin/internships/new" />}>
          <Plus />
          Add New
        </Button>
      </div>

      <InternshipsTable
        data={data}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={15}
      />
    </div>
  )
}