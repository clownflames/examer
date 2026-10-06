'use server'

import crypto from 'crypto'
import { db } from '@/db'
import {
  exams,
  examQuestions,
  examSubmission,
  questionMcqs,
  questionSubmission,
  internships,
  employeeDemand,
  payments,
} from '@/db/schema'
import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { CACHE_TAGS, invalidateTag } from '@/lib/cache'
import { LIMITS, rateLimit } from '@/lib/rate-limit'
import { buildAudioKey, getPublicUrl, getUploadPresignedUrl as getR2UploadUrl } from '@/lib/r2'

import type {
  Answers,
  AnswerValue,
  ExamForAttempt,
  ExamOption,
  ExamQuestionForAttempt,
  ExamResult,
  QuestionResult,
  SubmitExamResult,
} from './[id]/start/exam-runner-types'

// =====================================================
// HELPERS
// =====================================================

const MAX_ANSWER_LENGTH = 20000

async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id ?? null
  } catch (error) {
    console.error('[exams] currentUserId error:', error)
    return null
  }
}

async function hasPaidAccess(
  userId: string,
  internshipId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.internshipId, internshipId),
        eq(payments.status, 'paid')
      )
    )
    .limit(1)
  return rows.length > 0
}

type QuestionWithOptions = {
  id: string
  name: string
  details: string | null
  marks: number
  type: string
  defaultText: string | null
  options: { id: string; labelText: string; isCorrect: boolean }[]
}

async function loadQuestions(
  examId: string,
  includeAnswerKey: boolean
): Promise<QuestionWithOptions[]> {
  const questionRows = await db
    .select({
      id: examQuestions.id,
      name: examQuestions.name,
      details: examQuestions.details,
      marks: examQuestions.marks,
      type: examQuestions.type,
      defaultText: examQuestions.defaultText,
    })
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.createdAt), asc(examQuestions.id))

  if (questionRows.length === 0) return []

  const optionRows = await db
    .select({
      id: questionMcqs.id,
      questionId: questionMcqs.questionId,
      labelText: questionMcqs.labelText,
      isCorrect: questionMcqs.isCorrect,
    })
    .from(questionMcqs)
    .where(
      inArray(
        questionMcqs.questionId,
        questionRows.map((q) => q.id)
      )
    )
    .orderBy(asc(questionMcqs.labelText))

  const optionsByQuestion = new Map<
    string,
    { id: string; labelText: string; isCorrect: boolean }[]
  >()
  for (const opt of optionRows) {
    const list = optionsByQuestion.get(opt.questionId) ?? []
    list.push({
      id: opt.id,
      labelText: opt.labelText,
      isCorrect: includeAnswerKey ? opt.isCorrect : false,
    })
    optionsByQuestion.set(opt.questionId, list)
  }

  return questionRows.map((q) => ({
    ...q,
    marks: q.marks ?? 0,
    options: optionsByQuestion.get(q.id) ?? [],
  }))
}

function readMeta(raw: unknown): {
  score: number | null
  passed: boolean | null
} {
  if (!raw || typeof raw !== 'object') return { score: null, passed: null }
  const meta = raw as { score?: number; passed?: boolean | null }
  return {
    score: typeof meta.score === 'number' ? meta.score : null,
    passed: typeof meta.passed === 'boolean' ? meta.passed : null,
  }
}

/** Naive but safe URL check — only http(s). */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

// =====================================================
// LOAD EXAM FOR ATTEMPT
// =====================================================

export async function getExamForAttempt(
  examId: string
): Promise<ExamForAttempt | null> {
  const userId = await currentUserId()
  if (!userId || !examId) return null

  try {
    const [exam] = await db
      .select({
        id: exams.id,
        name: exams.name,
        orderNo: exams.orderNo,
        description: exams.description,
        duration: exams.duration,
        totalMarks: exams.totalMarks,
        passingMarks: exams.passingMarks,
        internshipId: exams.internshipId,
        internshipName: internships.name,
        demandName: employeeDemand.name,
      })
      .from(exams)
      .innerJoin(internships, eq(exams.internshipId, internships.id))
      .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
      .where(eq(exams.id, examId))
      .limit(1)

    if (!exam) return null

    if (!(await hasPaidAccess(userId, exam.internshipId))) return null

    const questions = await loadQuestions(examId, false)

    const attempts = await db
      .select({
        id: examSubmission.id,
        answers: examSubmission.answers,
        submittedAt: examSubmission.submittedAt,
      })
      .from(examSubmission)
      .where(
        and(
          eq(examSubmission.userId, userId),
          eq(examSubmission.examId, examId),
          isNotNull(examSubmission.submittedAt)
        )
      )
      .orderBy(desc(examSubmission.submittedAt))

    const latest = attempts[0] ?? null
    const meta = latest
      ? readMeta(latest.answers)
      : { score: null, passed: null }

    const mapped: ExamQuestionForAttempt[] = questions.map((q) => ({
      id: q.id,
      name: q.name,
      details: q.details,
      marks: q.marks ?? 0,
      type: q.type,
      defaultText: q.defaultText,
      options: q.options.map(
        (o): ExamOption => ({ id: o.id, labelText: o.labelText })
      ),
    }))

    return {
      id: exam.id,
      name: exam.name,
      orderNo: exam.orderNo,
      description: exam.description,
      duration: exam.duration,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      internshipId: exam.internshipId,
      internshipName: exam.internshipName,
      demandName: exam.demandName,
      computedTotal: questions.reduce((sum, q) => sum + (q.marks ?? 0), 0),
      questions: mapped,
      previousAttempt: latest
        ? {
            score: meta.score,
            passed: meta.passed,
            submittedAt: latest.submittedAt
              ? new Date(latest.submittedAt).toISOString()
              : null,
            attemptCount: attempts.length,
          }
        : null,
    }
  } catch (error) {
    console.error('[exams] getExamForAttempt error:', error)
    return null
  }
}

// =====================================================
// R2 UPLOAD URL (for voice answers)
// =====================================================

export async function getUploadPresignedUrl(input: {
  examId: string
  questionId: string
  contentType: string
}): Promise<
  | { success: true; uploadUrl: string; publicUrl: string; key: string }
  | { success: false; error: string }
> {
  const userId = await currentUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }

  if (!input.examId || !input.questionId) {
    return { success: false, error: 'Invalid input' }
  }

  // verify exam belongs to a paid internship of this user
  try {
    const [exam] = await db
      .select({
        id: exams.id,
        internshipId: exams.internshipId,
      })
      .from(exams)
      .where(eq(exams.id, input.examId))
      .limit(1)

    if (!exam) return { success: false, error: 'Exam not found' }
    if (!(await hasPaidAccess(userId, exam.internshipId))) {
      return { success: false, error: 'No access' }
    }

    const key = buildAudioKey(input.examId, userId, input.questionId)
    const uploadUrl = await getR2UploadUrl(
      key,
      input.contentType || 'audio/webm'
    )
    const publicUrl = getPublicUrl(key)

    return { success: true, uploadUrl, publicUrl, key }
  } catch (error) {
    console.error('[exams] getUploadPresignedUrl error:', error)
    return { success: false, error: 'Could not prepare upload' }
  }
}

// =====================================================
// SUBMIT + GRADE
// =====================================================

export async function submitExam(
  examId: string,
  rawAnswers: Answers | null | undefined
): Promise<SubmitExamResult> {
  // Stops a scripted client from hammering submit and writing rows.
  const submitLimit = await rateLimit(LIMITS.examSubmit)
  if (!submitLimit.ok) {
    return {
      success: false,
      error: 'Too many submission attempts. Please wait a moment.',
    }
  }

  const userId = await currentUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!examId) return { success: false, error: 'Invalid exam' }

  try {
    const [exam] = await db
      .select({
        id: exams.id,
        name: exams.name,
        passingMarks: exams.passingMarks,
        internshipId: exams.internshipId,
        internshipName: internships.name,
      })
      .from(exams)
      .innerJoin(internships, eq(exams.internshipId, internships.id))
      .where(eq(exams.id, examId))
      .limit(1)

    if (!exam) return { success: false, error: 'Exam not found' }

    if (!(await hasPaidAccess(userId, exam.internshipId))) {
      return {
        success: false,
        error: 'Your payment for this internship is not complete',
      }
    }

    const questions = await loadQuestions(examId, true)
    if (questions.length === 0) {
      return {
        success: false,
        error:
          'This exam has no questions yet. Please contact your examiner.',
      }
    }

    // ---- sanitise ----
    const clean: Record<string, AnswerValue> = {}
    for (const q of questions) {
      const raw = rawAnswers?.[q.id]
      if (!raw || typeof raw !== 'object') continue

      const value: AnswerValue = {}

      if (typeof raw.optionId === 'string' && q.type === 'mcq') {
        const allowed = new Set(q.options.map((o) => o.id))
        if (allowed.has(raw.optionId)) value.optionId = raw.optionId
      }

      if (typeof raw.audioUrl === 'string' && isHttpUrl(raw.audioUrl)) {
        value.audioUrl = raw.audioUrl.slice(0, 500)
      }

      if (typeof raw.text === 'string' && raw.text.trim()) {
        // For code questions, store plain text. For text/voice, keep HTML.
        value.text = raw.text.slice(0, MAX_ANSWER_LENGTH)
      }

      if (
        value.optionId ||
        value.audioUrl ||
        (value.text && value.text.trim())
      ) {
        clean[q.id] = value
      }
    }

    // ---- server-side validation: voice questions MUST have audio ----
    const missingAudio: string[] = []
    for (const q of questions) {
      if (q.type === 'voice') {
        const given = clean[q.id]
        if (!given?.audioUrl) {
          missingAudio.push(q.id)
        }
      }
    }

    if (missingAudio.length > 0) {
      return {
        success: false,
        error:
          missingAudio.length === 1
            ? 'One voice question is missing a recording.'
            : `${missingAudio.length} voice questions are missing a recording.`,
      }
    }

    // ---- grade ----
    const submissionId = crypto.randomUUID()
    const now = new Date()

    let score = 0
    let correctCount = 0
    let wrongCount = 0
    let pendingReview = 0
    let unanswered = 0
    let computedTotal = 0

    const perQuestion: QuestionResult[] = []
    const answerRows: (typeof questionSubmission.$inferInsert)[] = []

    for (const q of questions) {
      const marks = q.marks ?? 0
      computedTotal += marks
      const given = clean[q.id] ?? null

      if (q.type === 'mcq') {
        const correctOption = q.options.find((o) => o.isCorrect) ?? null
        const givenOptionId = given?.optionId ?? null
        const givenOption = givenOptionId
          ? q.options.find((o) => o.id === givenOptionId) ?? null
          : null

        let isCorrect: boolean | null
        if (!givenOptionId) {
          unanswered += 1
          isCorrect = null
        } else if (correctOption && givenOptionId === correctOption.id) {
          isCorrect = true
          score += marks
          correctCount += 1
        } else {
          isCorrect = false
          wrongCount += 1
        }

        perQuestion.push({
          questionId: q.id,
          questionName: q.name,
          marks,
          isCorrect,
          yourAnswer: givenOption?.labelText ?? null,
          correctAnswer: correctOption?.labelText ?? null,
        })

        answerRows.push({
          id: crypto.randomUUID(),
          questionId: q.id,
          examSubmissionId: submissionId,
          optionId: givenOptionId,
          text: null,
          isCorrect,
        })
        continue
      }

      // ---- text / code / voice ----
      // Store:
      //   questionSubmission.text = audioUrl ?? text ?? null
      //   examSubmission.answers JSONB keeps the full AnswerValue
      const audioUrl = given?.audioUrl ?? null
      const text = given?.text ?? null

      const storedText = audioUrl ?? text ?? null
      const hasAny = !!audioUrl || !!text

      if (!hasAny) {
        unanswered += 1
      } else {
        pendingReview += 1
      }

      perQuestion.push({
        questionId: q.id,
        questionName: q.name,
        marks,
        isCorrect: null,
        yourAnswer: audioUrl ?? text,
        correctAnswer: null,
      })

      answerRows.push({
        id: crypto.randomUUID(),
        questionId: q.id,
        examSubmissionId: submissionId,
        optionId: null,
        text: storedText,
        isCorrect: null,
      })
    }

    const passed =
      exam.passingMarks === null || exam.passingMarks === undefined
        ? null
        : pendingReview > 0 && score < exam.passingMarks
        ? null
        : score >= exam.passingMarks

    await db.transaction(async (tx) => {
      await tx.insert(examSubmission).values({
        id: submissionId,
        userId,
        examId,
        answers: {
          answers: clean,
          score,
          totalMarks: computedTotal,
          passed,
          pendingReview,
        },
        createdAt: now,
        submittedAt: now,
      })

      if (answerRows.length > 0) {
        await tx.insert(questionSubmission).values(answerRows)
      }
    })

    revalidatePath('/')
    revalidatePath('/internships')

    // A new score changes the tier list and the public counters.
    await invalidateTag(CACHE_TAGS.tierlist)
    await invalidateTag(CACHE_TAGS.stats)

    return {
      success: true,
      result: {
        submissionId,
        examName: exam.name,
        internshipName: exam.internshipName,
        score,
        totalMarks: computedTotal,
        passingMarks: exam.passingMarks ?? null,
        passed,
        correctCount,
        wrongCount,
        pendingReview,
        unanswered,
        totalQuestions: questions.length,
        submittedAt: now.toISOString(),
        perQuestion,
      },
    }
  } catch (error) {
    console.error('[exams] submitExam error:', error)
    return {
      success: false,
      error: 'Could not submit your exam. Please try again.',
    }
  }
}