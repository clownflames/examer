'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Code2,
  Eraser,
  Info,
  Loader2,
  Mic,
  Send,
  ShieldCheck,
  Trophy,
  Type,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { submitExam } from '../../actions'
import { AudioRecorder } from './audio-recorder'
import type {
  Answers,
  AnswerValue,
  ExamForAttempt,
  ExamResult,
} from './exam-runner-types'

const CodeEditor = dynamic(
  () => import('@/components/code-editor').then((m) => m.CodeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/40 h-[240px] w-full animate-pulse rounded-md border" />
    ),
  }
)

const RichTextEditor = dynamic(
  () =>
    import('@/components/rich-text-editor').then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/40 h-[180px] w-full animate-pulse rounded-md border" />
    ),
  }
)

// =====================================================
// HELPERS
// =====================================================

function fmtClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TYPE_META: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  mcq: {
    label: 'Multiple choice',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  text: { label: 'Written answer', icon: <Type className="h-3.5 w-3.5" /> },
  code: { label: 'Code', icon: <Code2 className="h-3.5 w-3.5" /> },
  voice: { label: 'Verbal', icon: <Mic className="h-3.5 w-3.5" /> },
}

function typeMeta(type: string) {
  return (
    TYPE_META[type] ?? {
      label: 'Answer',
      icon: <Info className="h-3.5 w-3.5" />,
    }
  )
}

// =====================================================
// Draft store (localStorage)
// =====================================================

const EMPTY_ANSWERS: Answers = {}
const draftListeners = new Set<() => void>()

function readDraftRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function parseDraft(raw: string | null): Answers | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    const out: Answers = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = v as AnswerValue
      }
    }
    return out
  } catch {
    return null
  }
}

function writeDraft(key: string, answers: Answers | null): void {
  try {
    if (answers && Object.keys(answers).length > 0) {
      window.localStorage.setItem(key, JSON.stringify(answers))
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // storage blocked or full — drafts are a convenience, never required
  }
  for (const listener of draftListeners) listener()
}

const subscribeDraft = (onStoreChange: () => void) => {
  draftListeners.add(onStoreChange)
  return () => {
    draftListeners.delete(onStoreChange)
  }
}

const getServerDraft = () => EMPTY_ANSWERS

/**
 * An answer is "filled" when:
 *  - MCQ: an option is selected
 *  - Voice: an audioUrl is present (audio is mandatory; text is optional)
 *  - Text/Code: text has real content
 */
function hasAnswer(
  v: AnswerValue | undefined,
  questionType: string
): boolean {
  if (!v) return false

  if (questionType === 'mcq') {
    return !!v.optionId
  }

  if (questionType === 'voice') {
    // Audio is mandatory — text alone doesn't count.
    return !!v.audioUrl
  }

  // text / code
  if (v.text && v.text.trim().length > 0) {
    const stripped = v.text.replace(/<[^>]*>/g, '').trim()
    return stripped.length > 0
  }
  return false
}

// =====================================================
// MAIN
// =====================================================

export default function ExamRunner({ exam }: { exam: ExamForAttempt }) {
  const total = exam.questions.length
  // v2 key — object-shaped answers
  const storageKey = `internbird:exam-draft:v2:${exam.id}`

  const [index, setIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(exam.duration * 60)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submittingRef = useRef(false)

  const draftCache = useRef<{
    key: string
    raw: string | null
    value: Answers
  }>({ key: storageKey, raw: null, value: EMPTY_ANSWERS })

  const getDraftSnapshot = useCallback(() => {
    const raw = readDraftRaw(storageKey)
    const cache = draftCache.current
    if (cache.key !== storageKey || cache.raw !== raw) {
      draftCache.current = {
        key: storageKey,
        raw,
        value: parseDraft(raw) ?? EMPTY_ANSWERS,
      }
    }
    return draftCache.current.value
  }, [storageKey])

  const answers = useSyncExternalStore(
    subscribeDraft,
    getDraftSnapshot,
    getServerDraft
  )

  const answeredIds = useMemo(() => {
    const set = new Set<string>()
    for (const q of exam.questions) {
      if (hasAnswer(answers[q.id], q.type)) set.add(q.id)
    }
    return set
  }, [answers, exam.questions])

  const answeredCount = exam.questions.filter((q) =>
    answeredIds.has(q.id)
  ).length

  const setAnswer = useCallback(
    (questionId: string, patch: Partial<AnswerValue>) => {
      const current = draftCache.current.value
      const prev = current[questionId] ?? {}
      const next: AnswerValue = { ...prev, ...patch }

      // Clean undefined / empty fields
      if (!next.text) delete next.text
      if (!next.audioUrl) delete next.audioUrl
      if (!next.optionId) delete next.optionId

      const updated: Answers = { ...current }
      if (Object.keys(next).length === 0) {
        delete updated[questionId]
      } else {
        updated[questionId] = next
      }
      writeDraft(storageKey, updated)
    },
    [storageKey]
  )

  const clearAnswer = useCallback(
    (questionId: string) => {
      const current = draftCache.current.value
      const updated: Answers = { ...current }
      delete updated[questionId]
      writeDraft(storageKey, updated)
    },
    [storageKey]
  )

  // ---- submit ----
  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (submittingRef.current) return
      submittingRef.current = true
      setSubmitting(true)
      setConfirmOpen(false)
      setSubmitError(null)

      try {
        // Client-side validation: every voice question needs a recording
        const missingAudio = exam.questions.filter(
          (q) => q.type === 'voice' && !answers[q.id]?.audioUrl
        )

        if (missingAudio.length > 0) {
          submittingRef.current = false
          setSubmitting(false)
          const firstIdx = exam.questions.findIndex(
            (q) => q.id === missingAudio[0].id
          )
          const msg =
            missingAudio.length === 1
              ? `Question ${firstIdx + 1} needs a voice recording.`
              : `${missingAudio.length} voice questions are missing a recording.`
          setSubmitError(msg)
          toast.error(msg)
          if (firstIdx >= 0) setIndex(firstIdx)
          return
        }

        const res = await submitExam(exam.id, answers)
        if (res.success) {
          setResult(res.result)
          writeDraft(storageKey, null)
          toast.success(
            auto
              ? 'Time is up — your exam was submitted automatically'
              : 'Exam submitted successfully'
          )
        } else {
          submittingRef.current = false
          setSubmitting(false)
          setSubmitError(res.error)
          toast.error(res.error)
        }
      } catch (error) {
        console.error('submitExam failed:', error)
        submittingRef.current = false
        setSubmitting(false)
        setSubmitError('Could not submit right now. Please try again.')
        toast.error('Could not submit right now. Please try again.')
      }
    },
    [answers, exam.id, exam.questions, storageKey]
  )

  const submitRef = useRef(doSubmit)
  useEffect(() => {
    submitRef.current = doSubmit
  }, [doSubmit])

  // ---- countdown ----
  useEffect(() => {
    if (result) return

    if (secondsLeft <= 0) {
      void submitRef.current(true)
      return
    }

    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft, result])

  // ---- warn before losing the exam ----
  useEffect(() => {
    if (result || answeredCount === 0) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [result, answeredCount])

  const current = exam.questions[index]
  const timeLow = secondsLeft <= 60
  const progressPct = total > 0 ? (answeredCount / total) * 100 : 0

  if (result) {
    return <ResultView result={result} exam={exam} />
  }

  if (total === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="bg-muted mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
            <Info className="text-muted-foreground h-6 w-6" />
          </div>
          <h1 className="mb-2 text-lg font-semibold">No questions yet</h1>
          <p className="text-muted-foreground mb-6 text-sm">
            Your examiner hasn&apos;t added any questions to this exam. Please
            check back soon.
          </p>
          <Button render={<Link href="/internships" />}>
            Back to internships
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* HEADER */}
      <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Exit exam"
            render={
              <Link href="/internships">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            }
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{exam.name}</p>
            <p className="text-muted-foreground truncate text-[11px]">
              {exam.internshipName}
              {exam.demandName ? ` · ${exam.demandName}` : ''}
            </p>
          </div>

          <div
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums',
              timeLow
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'bg-muted/50'
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            {fmtClock(secondsLeft)}
          </div>

          <Button size="sm" onClick={() => setConfirmOpen(true)}>
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Submit</span>
          </Button>
        </div>
      </header>

      {/* BODY */}
      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 space-y-4">
          {previousAttemptBanner(exam)}

          <div className="bg-card rounded-2xl border">
            <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3.5">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Question {index + 1} of {total}
              </span>
              <Badge variant="secondary" className="gap-1 text-[10px]">
                {typeMeta(current.type).icon}
                {typeMeta(current.type).label}
              </Badge>
              <Badge variant="outline" className="ml-auto text-[10px]">
                {current.marks} {current.marks === 1 ? 'mark' : 'marks'}
              </Badge>
            </div>

            <div className="space-y-5 p-5">
              <div
                className="rich-text text-foreground/90 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: current.name }}
              />

              {current.details && (
                <div
                  className="rich-text text-muted-foreground border-border border-l-2 pl-3 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: current.details }}
                />
              )}

              <Separator />

              <AnswerArea
                examId={exam.id}
                question={current}
                value={answers[current.id]}
                onChange={(patch) => setAnswer(current.id, patch)}
                onClear={() => clearAnswer(current.id)}
              />
            </div>

            <div className="flex items-center gap-2 border-t px-5 py-3.5">
              <Button
                variant="outline"
                size="sm"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Previous
              </Button>

              {current.type !== 'voice' && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!hasAnswer(answers[current.id], current.type)}
                  onClick={() => clearAnswer(current.id)}
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}

              {index < total - 1 ? (
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() =>
                    setIndex((i) => Math.min(total - 1, i + 1))
                  }
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Send className="h-3.5 w-3.5" />
                  Review &amp; Submit
                </Button>
              )}
            </div>
          </div>

          <div className="lg:hidden">
            <QuestionPalette
              exam={exam}
              index={index}
              answeredIds={answeredIds}
              onJump={setIndex}
            />
          </div>
        </div>

        {/* SIDEBAR */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="bg-card rounded-2xl border p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Progress
                </span>
                <span className="text-xs font-semibold">
                  {answeredCount}/{total}
                </span>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-2 text-[11px]">
                {total - answeredCount > 0
                  ? `${total - answeredCount} question${
                      total - answeredCount === 1 ? '' : 's'
                    } left`
                  : 'All questions answered'}
              </p>
            </div>

            <QuestionPalette
              exam={exam}
              index={index}
              answeredIds={answeredIds}
              onJump={setIndex}
            />

            <div className="bg-muted/30 rounded-2xl border p-4">
              <p className="text-muted-foreground flex gap-2 text-[11px] leading-relaxed">
                <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
                Your answers are saved in this browser. Submitting is final
                and cannot be undone.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* CONFIRM */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your exam?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered{' '}
              <strong>
                {answeredCount} of {total}
              </strong>{' '}
              questions
              {answeredCount < total && (
                <>
                  {' '}
                  and left <strong>{total - answeredCount}</strong> blank
                </>
              )}
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {submitError && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-xs">
              {submitError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>
              Keep writing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void doSubmit(false)}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit exam'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// =====================================================
// Question palette
// =====================================================

function QuestionPalette({
  exam,
  index,
  answeredIds,
  onJump,
}: {
  exam: ExamForAttempt
  index: number
  answeredIds: Set<string>
  onJump: (i: number) => void
}) {
  return (
    <div className="bg-card rounded-2xl border p-4">
      <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
        Questions
      </p>
      <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-6">
        {exam.questions.map((q, i) => {
          const active = i === index
          const answered = answeredIds.has(q.id)
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Go to question ${i + 1}${
                answered ? ' (answered)' : ''
              }`}
              aria-current={active}
              className={cn(
                'h-8 w-full rounded-md border text-[11px] font-semibold transition-colors',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : answered
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-muted text-muted-foreground hover:border-border border-transparent'
              )}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// =====================================================
// Answer area
// =====================================================

function AnswerArea({
  examId,
  question,
  value,
  onChange,
  onClear,
}: {
  examId: string
  question: ExamForAttempt['questions'][number]
  value: AnswerValue | undefined
  onChange: (patch: Partial<AnswerValue>) => void
  onClear: () => void
}) {
  if (question.type === 'mcq') {
    if (question.options.length === 0) {
      return (
        <p className="text-muted-foreground text-xs">
          No options were configured for this question. Skipping.
        </p>
      )
    }
    return (
      <div className="space-y-2" role="radiogroup" aria-label="Answer options">
        {question.options.map((opt, i) => {
          const selected = value?.optionId === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ optionId: opt.id })}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40'
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground'
                )}
              >
                {selected ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className="rich-text wrap-break-word min-w-0 flex-1"
                dangerouslySetInnerHTML={{ __html: opt.labelText }}
              />
            </button>
          )
        })}
      </div>
    )
  }

  if (question.type === 'code') {
    return (
      <div className="space-y-2">
        <CodeEditor
          value={value?.text || question.defaultText || ''}
          onChange={(v) => onChange({ text: v })}
          height="280px"
        />
        <p className="text-muted-foreground text-[11px]">
          Write your solution below. An examiner will review it manually.
        </p>
      </div>
    )
  }

  if (question.type === 'voice') {
    return (
      <VoiceAnswerArea
        examId={examId}
        questionId={question.id}
        value={value}
        onChange={onChange}
        onClear={onClear}
      />
    )
  }

  // ---- text (rich text editor) ----
  return (
    <div className="space-y-2">
      <RichTextEditor
        value={value?.text ?? ''}
        onChange={(html) => onChange({ text: html })}
        placeholder="Write your answer here…"
        minHeight="200px"
      />
      {hasAnswer(value, 'text') && (
        <button
          type="button"
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline"
        >
          Clear answer
        </button>
      )}
    </div>
  )
}

// =====================================================
// Voice answer (audio mandatory + optional text notes)
// =====================================================

function VoiceAnswerArea({
  examId,
  questionId,
  value,
  onChange,
  onClear,
}: {
  examId: string
  questionId: string
  value: AnswerValue | undefined
  onChange: (patch: Partial<AnswerValue>) => void
  onClear: () => void
}) {
  return (
    <div className="space-y-4">
      {/* Mandatory warning */}
      <div className="border-primary/20 bg-primary/5 flex items-start gap-2 rounded-lg border px-3 py-2">
        <Mic className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="text-muted-foreground text-xs">
          <span className="text-foreground font-medium">
            Recording is required
          </span>{' '}
          for this question. Speak clearly — you can re-record before
          submitting.
        </p>
      </div>

      {/* Recorder — always visible, mandatory */}
      <AudioRecorder
        examId={examId}
        questionId={questionId}
        value={value?.audioUrl ?? null}
        onChange={(url) => onChange({ audioUrl: url ?? undefined })}
      />

      {/* Optional text notes */}
      <div className="space-y-1.5">
        <p className="text-muted-foreground text-[11px]">
          Optional — add notes to help your examiner (not required).
        </p>
        <RichTextEditor
          value={value?.text ?? ''}
          onChange={(html) => onChange({ text: html })}
          placeholder="Optional notes…"
          minHeight="140px"
        />
      </div>

      {/* Status */}
      <p className="text-[11px]">
        {value?.audioUrl ? (
          <span className="text-emerald-600 dark:text-emerald-500">
            ✓ Recording attached
            {value?.text ? ' · Notes attached' : ''}
          </span>
        ) : (
          <span className="text-destructive">
            ✗ No recording yet — this question cannot be submitted without
            audio.
          </span>
        )}
      </p>
    </div>
  )
}

// =====================================================
// Previous attempt banner
// =====================================================

function previousAttemptBanner(exam: ExamForAttempt) {
  const prev = exam.previousAttempt
  if (!prev) return null

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="text-muted-foreground text-xs">
        <p className="text-foreground mb-0.5 font-semibold">
          Retaking — attempt #{prev.attemptCount + 1}
        </p>
        <p>
          Your last attempt scored{' '}
          <strong className="text-foreground">
            {prev.score ?? '—'} / {exam.computedTotal || exam.totalMarks}
          </strong>
          {prev.submittedAt ? ` on ${fmtDateTime(prev.submittedAt)}` : ''}.
          Only this attempt will be graded.
        </p>
      </div>
    </div>
  )
}

// =====================================================
// Result screen
// =====================================================

function ResultView({
  result,
  exam,
}: {
  result: ExamResult
  exam: ExamForAttempt
}) {
  const pct =
    result.totalMarks > 0
      ? Math.round((result.score / result.totalMarks) * 100)
      : 0

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="bg-card rounded-2xl border p-6 text-center">
          <div
            className={cn(
              'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl',
              result.passed === true
                ? 'border border-emerald-500/30 bg-emerald-500/10'
                : result.passed === false
                ? 'bg-destructive/10 border-destructive/30 border'
                : 'border border-amber-500/30 bg-amber-500/10'
            )}
          >
            {result.passed === true ? (
              <Trophy className="h-7 w-7 text-emerald-500" />
            ) : result.passed === false ? (
              <XCircle className="text-destructive h-7 w-7" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-amber-500" />
            )}
          </div>

          <h1 className="mb-1 text-xl font-bold">Exam submitted</h1>
          <p className="text-muted-foreground mb-5 text-sm">
            {result.examName} · {result.internshipName}
          </p>

          <div className="mb-4 flex items-end justify-center gap-2">
            <span className="text-5xl font-bold tabular-nums">
              {result.score}
            </span>
            <span className="text-muted-foreground mb-1.5 text-xl">
              / {result.totalMarks}
            </span>
          </div>

          <div className="bg-muted mx-auto mb-4 h-2 w-full max-w-xs overflow-hidden rounded-full">
            <div
              className={cn(
                'h-full rounded-full',
                result.passed === true
                  ? 'bg-emerald-500'
                  : result.passed === false
                  ? 'bg-destructive'
                  : 'bg-amber-500'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>

          <Badge
            variant="outline"
            className={cn(
              'text-[11px]',
              result.passed === true
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                : result.passed === false
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-500'
            )}
          >
            {result.passed === true
              ? 'Passed'
              : result.passed === false
              ? 'Not passed'
              : 'Pending review'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Correct" value={result.correctCount} tone="good" />
          <StatTile label="Wrong" value={result.wrongCount} tone="bad" />
          <StatTile
            label="In review"
            value={result.pendingReview}
            tone="warn"
          />
          <StatTile label="Skipped" value={result.unanswered} />
        </div>

        {result.pendingReview > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-muted-foreground text-xs">
              {result.pendingReview} written / code{' '}
              {result.pendingReview === 1 ? 'answer is' : 'answers are'} still
              with your examiner. Your final score will update once they are
              graded.
            </p>
          </div>
        )}

        <div className="bg-card rounded-2xl border">
          <div className="border-b px-5 py-3.5">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Answer review
            </h2>
          </div>

          <div className="divide-y">
            {result.perQuestion.map((q, i) => (
              <div key={q.questionId} className="space-y-2 px-5 py-4">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5 shrink-0 text-xs font-bold">
                    {i + 1}.
                  </span>
                  <div
                    className="rich-text min-w-0 flex-1 text-sm"
                    dangerouslySetInnerHTML={{ __html: q.questionName }}
                  />
                  {q.isCorrect === true ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : q.isCorrect === false ? (
                    <XCircle className="text-destructive h-4 w-4 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                </div>

                <div className="space-y-1 pl-6 text-xs">
                  <p className="text-muted-foreground">
                    <span className="text-foreground/70 font-medium">
                      Your answer:{' '}
                    </span>
                    {q.yourAnswer ? (
                      <span
                        className="rich-text"
                        dangerouslySetInnerHTML={{ __html: q.yourAnswer }}
                      />
                    ) : (
                      <span className="italic">Not answered</span>
                    )}
                  </p>
                  {q.correctAnswer && (
                    <p className="text-muted-foreground">
                      <span className="text-foreground/70 font-medium">
                        Correct answer:{' '}
                      </span>
                      <span
                        className="rich-text text-emerald-500"
                        dangerouslySetInnerHTML={{ __html: q.correctAnswer }}
                      />
                    </p>
                  )}
                  {q.correctAnswer === null && q.yourAnswer && (
                    <p className="text-muted-foreground italic">
                      Awaiting examiner review
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" render={<Link href="/internships" />}>
            Back to internships
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            render={<Link href="/" />}
          >
            Go to home
          </Button>
        </div>

        <p className="text-muted-foreground text-center text-[11px]">
          Submitted on {fmtDateTime(result.submittedAt)} · Exam duration{' '}
          {exam.duration} min
        </p>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'good' | 'bad' | 'warn'
}) {
  return (
    <div className="bg-card rounded-xl border p-3 text-center">
      <p
        className={cn(
          'text-lg font-bold tabular-nums',
          tone === 'good' && 'text-emerald-500',
          tone === 'bad' && 'text-destructive',
          tone === 'warn' && 'text-amber-500'
        )}
      >
        {value}
      </p>
      <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
        {label}
      </p>
    </div>
  )
}