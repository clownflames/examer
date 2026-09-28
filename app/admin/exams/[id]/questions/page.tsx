// app/admin/exams/[id]/questions/page.tsx
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ExamQuestionsDrawer } from '../../exam-questions-drawer'

export default async function ExamQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href="/admin/exams" />}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Exam Questions
          </h2>
          <p className="text-muted-foreground text-sm">
            Manage questions for this exam.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <ExamQuestionsDrawer examId={id} />
      </div>
    </div>
  )
}