import { getDemands } from './actions'
import { DemandsTable } from './demands-table'

export default async function DemandsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const { data, totalPages, total } = await getDemands(page)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Demands</h2>
          <p className="text-muted-foreground text-sm">
            Manage employee demand categories. Internships and teams belong to
            a demand.
          </p>
        </div>
      </div>

      <DemandsTable
        data={data}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={15}
      />
    </div>
  )
}