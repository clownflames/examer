import { getExams, getInternshipOptions } from './actions'
import { ExamsTable } from './exams-table'

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const [{ data, totalPages, total }, internshipOptions] = await Promise.all([
    getExams(page),
    getInternshipOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Exams</h2>
        <p className="text-muted-foreground text-sm">
          Create and manage exams for internships.
        </p>
      </div>

      <ExamsTable
        data={data}
        internshipOptions={internshipOptions}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={15}
      />
    </div>
  )
}