import { getExamSubmissions, getExamOptions } from './actions'
import { PAGE_SIZE } from './constants'
import { ExamSubmissionsTable } from './exam-submissions-table'

export default async function ExamSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    examId?: string
    status?: string
  }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const examId = params.examId || null
  const status =
    params.status === 'pending' || params.status === 'reviewed'
      ? params.status
      : 'all'

  const [{ data, totalPages, total }, examOptions] = await Promise.all([
    getExamSubmissions(page, examId, status),
    getExamOptions(),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Exam Submissions
        </h1>
        <p className="text-muted-foreground text-sm">
          Review student answers, mark them correct or wrong, and listen to
          voice responses.
        </p>
      </div>

      <ExamSubmissionsTable
        data={data}
        examOptions={examOptions}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        currentExamId={examId}
        currentStatus={status}
      />
    </div>
  )
}