import { getRegistrations } from './actions'
import { RegistrationsTable } from './registrations-table'

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const { data, totalPages, total } = await getRegistrations(page)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Registrations
        </h2>
        <p className="text-muted-foreground text-sm">
          Manage student registrations for internships.
        </p>
      </div>

      <RegistrationsTable
        data={data}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={15}
      />
    </div>
  )
}