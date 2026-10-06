import {
  getAllEmailNotificationCounts,
  getExams,
  getInternshipOptions,
  getPendingDeliveryCheckCount,
} from './actions'
import { ExamsTable } from './exams-table'

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const [
    { data, totalPages, total },
    internshipOptions,
    emailCounts,
    pendingEmailChecks,
  ] = await Promise.all([
    getExams(page),
    getInternshipOptions(),
    getAllEmailNotificationCounts(),
    getPendingDeliveryCheckCount(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Exams</h2>
        <p className="text-muted-foreground text-sm">
          Create and manage exams for internships. New exams can be announced
          by email to every student who has paid for the internship — the{' '}
          <strong>Emails</strong> column shows who got it.
        </p>
      </div>

      <ExamsTable
        data={data}
        internshipOptions={internshipOptions}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={15}
        emailCounts={emailCounts}
        pendingEmailChecks={pendingEmailChecks}
      />
    </div>
  )
}