'use client'

import * as React from 'react'
import {
    Check,
    CheckCircle2,
    Clock,
    Loader2,
    Music,
    X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getSubmissionDetail, markQuestionCorrect } from './actions'
import type { SubmissionAnswer, SubmissionDetail } from './constants'

/* -------------------------------------------------------------------------- */
/*  Utils                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Detect whether the answer text is an audio URL pointing to an R2 file.
 */
function isAudioAnswer(a: SubmissionAnswer): boolean {
    if (!a.answerText) return false
    const url = a.answerText.trim()
    if (!/^https?:\/\//i.test(url)) return false
    return /\.(webm|mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(url)
}

/* -------------------------------------------------------------------------- */
/*  Drawer                                                                     */
/* -------------------------------------------------------------------------- */

export function SubmissionDetailDrawer({
    submissionId,
    open,
    onOpenChange,
}: {
    submissionId: string | null
    open: boolean
    onOpenChange: (o: boolean) => void
}) {
    const [detail, setDetail] = React.useState<SubmissionDetail | null>(null)
    const [loading, setLoading] = React.useState(false)

    React.useEffect(() => {
        if (!open || !submissionId) return
        let cancelled = false
        setLoading(true)
        setDetail(null)

        getSubmissionDetail(submissionId)
            .then((d) => {
                if (!cancelled) setDetail(d)
            })
            .catch((err) => {
                console.error(err)
                toast.error('Failed to load submission.')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [open, submissionId])

    /** Update one answer in-place after marking. */
    function handleMarked(questionSubmissionId: string, isCorrect: boolean) {
        setDetail((prev) => {
            if (!prev) return prev
            const nextAnswers = prev.answers.map((a) =>
                a.id === questionSubmissionId ? { ...a, isCorrect } : a
            )
            const earnedMarks = nextAnswers.reduce(
                (sum, a) => (a.isCorrect === true ? sum + a.questionMarks : sum),
                0
            )
            const fullyReviewed = nextAnswers.every((a) => a.isCorrect !== null)
            return { ...prev, answers: nextAnswers, earnedMarks, fullyReviewed }
        })
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            swipeDirection="down"
        >
            <DrawerContent className="flex h-[92vh] w-full flex-col">
                <DrawerHeader className="border-b">
                    <DrawerTitle>Submission Review</DrawerTitle>
                    <DrawerDescription>
                        Mark each answer correct or wrong. Score updates live.
                    </DrawerDescription>
                </DrawerHeader>

                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                        </div>
                    ) : !detail ? (
                        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                            No submission data.
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
                            <div className="flex flex-col gap-4 p-4">
                                {/* Student header */}
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={detail.userImage ?? undefined} />
                                            <AvatarFallback>
                                                {(detail.userName ?? 'U').slice(0, 1).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {detail.userName ?? 'Unknown'}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                {detail.userEmail ?? ''}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1">
                                        <Badge variant={detail.fullyReviewed ? 'default' : 'outline'}>
                                            {detail.fullyReviewed ? 'Fully reviewed' : 'In progress'}
                                        </Badge>
                                        <span className="text-muted-foreground text-xs">
                                            Submitted{' '}
                                            {detail.submittedAt
                                                ? format(new Date(detail.submittedAt), 'MMM d · HH:mm')
                                                : '—'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-md border p-3">
                                        <p className="text-muted-foreground text-xs">Exam</p>
                                        <p className="font-medium">{detail.examName}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {detail.internshipName}
                                        </p>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <p className="text-muted-foreground text-xs">Score</p>
                                        <p className="text-lg font-semibold tabular-nums">
                                            {detail.earnedMarks} / {detail.totalMarks}
                                        </p>
                                    </div>
                                </div>

                                <Separator />

                                {/* Answers */}
                                <div className="flex flex-col gap-4">
                                    {detail.answers.map((a, idx) => (
                                        <AnswerCard
                                            key={a.questionId}
                                            index={idx + 1}
                                            answer={a}
                                            onMarked={handleMarked}
                                        />
                                    ))}
                                </div>
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}

/* -------------------------------------------------------------------------- */
/*  Answer card                                                                */
/* -------------------------------------------------------------------------- */

function AnswerCard({
    index,
    answer,
    onMarked,
}: {
    index: number
    answer: SubmissionAnswer
    onMarked: (id: string, isCorrect: boolean) => void
}) {
    const [pending, setPending] = React.useState(false)

    async function mark(value: boolean) {
        if (!answer.id) {
            toast.error('This question was not answered.')
            return
        }
        setPending(true)
        const res = await markQuestionCorrect(answer.id, value)
        setPending(false)
        if (res.success) {
            onMarked(answer.id, value)
        } else {
            toast.error(res.error ?? 'Failed to update.')
        }
    }

    const correctState = answer.isCorrect
    const audio = isAudioAnswer(answer)

    return (
        <div className="rounded-lg border p-4">
            {/* Header */}
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                    <Badge variant="outline" className="tabular-nums">
                        Q{index}
                    </Badge>
                    <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{answer.questionName}</span>
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                            <span className="uppercase tracking-wide">
                                {answer.questionType}
                            </span>
                            <span>·</span>
                            <span>{answer.questionMarks} marks</span>
                        </div>
                    </div>
                </div>

                {correctState === true && (
                    <Badge className="gap-1">
                        <Check className="h-3 w-3" />
                        Correct
                    </Badge>
                )}
                {correctState === false && (
                    <Badge variant="destructive" className="gap-1">
                        <X className="h-3 w-3" />
                        Wrong
                    </Badge>
                )}
                {correctState === null && (
                    <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                    </Badge>
                )}
            </div>

            {answer.questionDetails && (
                <p className="text-muted-foreground mb-3 text-sm whitespace-pre-wrap">
                    {answer.questionDetails}
                </p>
            )}

            {/* Answer body */}
            <div className="mb-4 rounded-md bg-muted/40 p-3">
                {answer.questionType === 'mcq' ? (
                    <McqAnswerView answer={answer} />
                ) : audio ? (
                    <AudioAnswerView url={answer.answerText!} />
                ) : (
                    <TextAnswerView text={answer.answerText} type={answer.questionType} />
                )}
            </div>

            {/* Mark buttons */}
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    variant={correctState === true ? 'default' : 'outline'}
                    className="gap-1"
                    onClick={() => mark(true)}
                    disabled={pending}
                >
                    {pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Check className="h-3.5 w-3.5" />
                    )}
                    Correct
                </Button>
                <Button
                    size="sm"
                    variant={correctState === false ? 'destructive' : 'outline'}
                    className="gap-1"
                    onClick={() => mark(false)}
                    disabled={pending}
                >
                    <X className="h-3.5 w-3.5" />
                    Wrong
                </Button>
            </div>
        </div>
    )
}

/* -------------------------------------------------------------------------- */
/*  Answer views                                                               */
/* -------------------------------------------------------------------------- */

function McqAnswerView({ answer }: { answer: SubmissionAnswer }) {
    return (
        <div className="flex flex-col gap-1.5">
            {answer.mcqOptions.map((opt) => {
                const isPicked = opt.id === answer.answerOptionId
                return (
                    <div
                        key={opt.id}
                        className={
                            'flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ' +
                            (isPicked
                                ? 'border-primary bg-primary/5 font-medium'
                                : 'border-transparent')
                        }
                    >
                        <span className="text-muted-foreground w-4 text-xs">
                            {isPicked ? '→' : ''}
                        </span>
                        <span className="flex-1">{opt.labelText}</span>
                        {opt.isCorrect && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                    </div>
                )
            })}
            {!answer.answerOptionId && (
                <p className="text-muted-foreground text-xs italic">
                    No option selected.
                </p>
            )}
        </div>
    )
}

function TextAnswerView({
    text,
    type,
}: {
    text: string | null
    type: string
}) {
    if (!text) {
        return (
            <p className="text-muted-foreground text-sm italic">
                No answer submitted.
            </p>
        )
    }
    return (
        <pre
            className={
                'text-sm whitespace-pre-wrap break-words ' +
                (type === 'code' ? 'font-mono' : 'font-sans')
            }
        >
            {text}
        </pre>
    )
}

function AudioAnswerView({ url }: { url: string }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Music className="h-3.5 w-3.5" />
                Voice response
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={url} className="w-full" preload="metadata" />
        </div>
    )
}