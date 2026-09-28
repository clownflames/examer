import { getTeams, getInternshipOptions, getDemandOptions } from './actions'
import { TeamsTable } from './teams-table'

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const [{ data, totalPages, total }, internshipOptions, demandOptions] =
    await Promise.all([
      getTeams(page),
      getInternshipOptions(),
      getDemandOptions(),
    ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Teams</h2>
        <p className="text-muted-foreground text-sm">
          Create teams and assign students to internships.
        </p>
      </div>

      <TeamsTable
        data={data}
        internshipOptions={internshipOptions}
        demandOptions={demandOptions}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={15}
      />
    </div>
  )
}