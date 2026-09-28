'use client'

import * as React from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { QuestionForm } from './question-form'
import {
  getExamInfo,
  getQuestionsForExam,
  deleteQuestion,
} from './questions-actions'
import {
  QUESTION_TYPE_LABELS,
  type ExamInfo,
  type QuestionRow,
} from './questions-constants'

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; question: QuestionRow }

export function ExamQuestionsDrawer({ examId }: { examId: string }) {
  const [exam, setExam] = React.useState<ExamInfo | null>(null)
  const [questions, setQuestions] = React.useState<QuestionRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [view, setView] = React.useState<View>({ kind: 'list' })

  const refresh = React.useCallback(async () => {
    const [info, list] = await Promise.all([
      getExamInfo(examId),
      getQuestionsForExam(examId),
    ])
    setExam(info)
    setQuestions(list)
  }, [examId])

  React.useEffect(() => {
    let mounted = true
    async function load() {
      try {
        await refresh()
      } catch (err) {
        console.error('Failed to load questions:', err)
        toast.error('Failed to load questions.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [refresh])

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading questions…</p>
  }

  /* -------- Form view (create or edit) -------- */
  if (view.kind === 'create' || view.kind === 'edit') {
    return (
      <QuestionForm
        key={view.kind === 'edit' ? view.question.id : 'new'}
        examId={examId}
        initial={view.kind === 'edit' ? view.question : undefined}
        onCancel={() => setView({ kind: 'list' })}
        onSuccess={async () => {
          await refresh()
          setView({ kind: 'list' })
        }}
      />
    )
  }

  /* -------- List view -------- */
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col text-sm">
          {exam && (
            <>
              <span className="text-muted-foreground">
                {exam.internshipName}
              </span>
              <span className="text-muted-foreground text-xs">
                {questions.length} question
                {questions.length === 1 ? '' : 's'} · {totalMarks} marks
                {exam.totalMarks ? ` / ${exam.totalMarks} total` : ''}
              </span>
            </>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setView({ kind: 'create' })
          }}
        >
          <Plus />
          Add Question
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          No questions yet. Click <strong>Add Question</strong> to create one.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {questions.map((q, index) => (
            <li
              key={q.id}
              className="bg-card flex flex-col gap-2 rounded-lg border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-xs">
                      Q{index + 1}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {q.marks} mark{q.marks === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{q.name}</p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Edit question"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setView({ kind: 'edit', question: q })
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <DeleteQuestionButton
                    id={q.id}
                    name={q.name}
                    onDeleted={refresh}
                  />
                </div>
              </div>

              {q.type === 'mcq' && q.options.length > 0 && (
                <ul className="ml-1 flex flex-col gap-1 text-xs">
                  {q.options.map((o) => (
                    <li
                      key={o.id}
                      className={
                        o.isCorrect
                          ? 'text-green-600 dark:text-green-500'
                          : 'text-muted-foreground'
                      }
                    >
                      {o.isCorrect ? '✓ ' : '• '}
                      {o.labelText}
                    </li>
                  ))}
                </ul>
              )}

              {q.type === 'text' && q.defaultText && (
                <p className="text-muted-foreground text-xs">
                  Default answer: {q.defaultText}
                </p>
              )}
              {q.type === 'code' && q.defaultText && (
                <pre className="bg-muted text-foreground overflow-x-auto rounded px-2 py-1 text-xs">
                  {q.defaultText}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DeleteQuestionButton({
  id,
  name,
  onDeleted,
}: {
  id: string
  name: string
  onDeleted: () => void | Promise<void>
}) {
  const [pending, setPending] = React.useState(false)

  async function handleDelete() {
    setPending(true)
    const result = await deleteQuestion(id)
    setPending(false)

    if (result.success) {
      toast.success('Question deleted.')
      await onDeleted()
    } else {
      toast.error(result.error ?? 'Failed to delete.')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Delete question"
            disabled={pending}
          >
            <Trash2 className="text-destructive h-3.5 w-3.5" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this question?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{name}</strong> will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={pending}>
            {pending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}