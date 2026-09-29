'use server'

import { revalidatePath } from 'next/cache'
import { and, count, desc, eq, sql, inArray, asc } from 'drizzle-orm'

import { db } from '@/db'
import {
  examSubmission,
  questionSubmission,
  examQuestions,
  questionMcqs,
  exams,
  internships,
  user,
} from '@/db/schema'
import {
  PAGE_SIZE,
  type SubmissionRow,
  type SubmissionDetail,
  type SubmissionAnswer,
  type ExamOption,
} from './constants'

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getExamSubmissions(
  page = 1,
  examId?: string | null,
  status?: 'all' | 'pending' | 'reviewed'
): Promise<{
  data: SubmissionRow[]
  page: number
  totalPages: number
  total: number
}> {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const offset = (safePage - 1) * PAGE_SIZE

  // total questions per exam
  const totalQuestionsSql = sql<number>`(
    select count(*)::int from ${examQuestions}
    where ${examQuestions.examId} = ${examSubmission.examId}
  )`

  // reviewed count for this submission
  const reviewedCountSql = sql<number>`(
    select count(*)::int from ${questionSubmission}
    where ${questionSubmission.examSubmissionId} = ${examSubmission.id}
      and ${questionSubmission.isCorrect} is not null
  )`

  const filters = []
  if (examId) filters.push(eq(examSubmission.examId, examId))

  const baseWhere = filters.length > 0 ? and(...filters) : undefined

  const rows = await db
    .select({
      id: examSubmission.id,
      userId: examSubmission.userId,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      examId: examSubmission.examId,
      examName: exams.name,
      internshipId: exams.internshipId,
      internshipName: internships.name,
      submittedAt: examSubmission.submittedAt,
      createdAt: examSubmission.createdAt,
      totalQuestions: totalQuestionsSql.as('total_questions'),
      reviewedCount: reviewedCountSql.as('reviewed_count'),
    })
    .from(examSubmission)
    .innerJoin(user, eq(examSubmission.userId, user.id))
    .innerJoin(exams, eq(examSubmission.examId, exams.id))
    .innerJoin(internships, eq(exams.internshipId, internships.id))
    .where(baseWhere)
    .orderBy(desc(examSubmission.submittedAt), desc(examSubmission.createdAt))
    .limit(PAGE_SIZE * 4) // over-fetch so we can filter by status below
    .offset(offset)

  let mapped = rows.map((r) => {
    const totalQ = Number(r.totalQuestions ?? 0)
    const reviewed = Number(r.reviewedCount ?? 0)
    return {
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      userImage: r.userImage,
      examId: r.examId,
      examName: r.examName,
      internshipId: r.internshipId,
      internshipName: r.internshipName,
      submittedAt: r.submittedAt,
      createdAt: r.createdAt,
      totalQuestions: totalQ,
      reviewedCount: reviewed,
      fullyReviewed: totalQ > 0 && reviewed >= totalQ,
    } satisfies SubmissionRow
  })

  if (status === 'pending') {
    mapped = mapped.filter((r) => !r.fullyReviewed)
  } else if (status === 'reviewed') {
    mapped = mapped.filter((r) => r.fullyReviewed)
  }

  // total count (for pagination, without status filter — approximate)
  const totalResult = await db
    .select({ value: count() })
    .from(examSubmission)
    .where(baseWhere)

  const total = Number(totalResult[0]?.value ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return {
    data: mapped.slice(0, PAGE_SIZE),
    page: safePage,
    totalPages,
    total,
  }
}

/* -------------------------------------------------------------------------- */
/*  Exam options (for filter dropdown)                                         */
/* -------------------------------------------------------------------------- */

export async function getExamOptions(): Promise<ExamOption[]> {
  const rows = await db
    .select({
      id: exams.id,
      name: exams.name,
      internshipName: internships.name,
    })
    .from(exams)
    .innerJoin(internships, eq(exams.internshipId, internships.id))
    .orderBy(desc(exams.createdAt))

  return rows
}

/* -------------------------------------------------------------------------- */
/*  Detail (for the drawer)                                                    */
/* -------------------------------------------------------------------------- */

export async function getSubmissionDetail(
  submissionId: string
): Promise<SubmissionDetail | null> {
  const [sub] = await db
    .select({
      id: examSubmission.id,
      userId: examSubmission.userId,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      examId: examSubmission.examId,
      examName: exams.name,
      internshipName: internships.name,
      submittedAt: examSubmission.submittedAt,
      createdAt: examSubmission.createdAt,
    })
    .from(examSubmission)
    .innerJoin(user, eq(examSubmission.userId, user.id))
    .innerJoin(exams, eq(examSubmission.examId, exams.id))
    .innerJoin(internships, eq(exams.internshipId, internships.id))
    .where(eq(examSubmission.id, submissionId))
    .limit(1)

  if (!sub) return null

  // Fetch all questions for this exam, ordered
  const questions = await db
    .select({
      id: examQuestions.id,
      name: examQuestions.name,
      type: examQuestions.type,
      marks: examQuestions.marks,
      details: examQuestions.details,
      defaultText: examQuestions.defaultText,
    })
    .from(examQuestions)
    .where(eq(examQuestions.examId, sub.examId))
    .orderBy(asc(examQuestions.createdAt))

  if (questions.length === 0) {
    return {
      id: sub.id,
      userName: sub.userName,
      userEmail: sub.userEmail,
      userImage: sub.userImage,
      examName: sub.examName,
      internshipName: sub.internshipName,
      submittedAt: sub.submittedAt,
      createdAt: sub.createdAt,
      totalMarks: 0,
      earnedMarks: 0,
      fullyReviewed: false,
      answers: [],
    }
  }

  const questionIds = questions.map((q) => q.id)

  // MCQ options for all MCQ questions
  const mcqOptions = await db
    .select({
      id: questionMcqs.id,
      questionId: questionMcqs.questionId,
      labelText: questionMcqs.labelText,
      isCorrect: questionMcqs.isCorrect,
    })
    .from(questionMcqs)
    .where(inArray(questionMcqs.questionId, questionIds))

  const mcqByQuestion = new Map<string, typeof mcqOptions>()
  for (const o of mcqOptions) {
    const list = mcqByQuestion.get(o.questionId) ?? []
    list.push(o)
    mcqByQuestion.set(o.questionId, list)
  }

  // Existing answers from student
  const submittedAnswers = await db
    .select({
      id: questionSubmission.id,
      questionId: questionSubmission.questionId,
      optionId: questionSubmission.optionId,
      text: questionSubmission.text,
      isCorrect: questionSubmission.isCorrect,
    })
    .from(questionSubmission)
    .where(eq(questionSubmission.examSubmissionId, submissionId))

  const answerByQuestion = new Map<
    string,
    (typeof submittedAnswers)[number]
  >()
  for (const a of submittedAnswers) {
    answerByQuestion.set(a.questionId, a)
  }

  const answers: SubmissionAnswer[] = questions.map((q) => {
    const ans = answerByQuestion.get(q.id)
    const opts = mcqByQuestion.get(q.id) ?? []
    const pickedOption = ans?.optionId
      ? opts.find((o) => o.id === ans.optionId) ?? null
      : null

    return {
      id: ans?.id ?? '', // empty when student never answered
      questionId: q.id,
      questionName: q.name,
      questionType: q.type,
      questionMarks: q.marks,
      questionDetails: q.details,
      questionDefaultText: q.defaultText,
      answerText: ans?.text ?? null,
      answerOptionId: ans?.optionId ?? null,
      answerOptionLabel: pickedOption?.labelText ?? null,
      mcqOptions: opts.map((o) => ({
        id: o.id,
        labelText: o.labelText,
        isCorrect: o.isCorrect,
      })),
      isCorrect: ans?.isCorrect ?? null,
    }
  })

  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)
  const earnedMarks = answers.reduce((sum, a) => {
    if (a.isCorrect === true) return sum + a.questionMarks
    return sum
  }, 0)

  const fullyReviewed = answers.every((a) => a.isCorrect !== null)

  return {
    id: sub.id,
    userName: sub.userName,
    userEmail: sub.userEmail,
    userImage: sub.userImage,
    examName: sub.examName,
    internshipName: sub.internshipName,
    submittedAt: sub.submittedAt,
    createdAt: sub.createdAt,
    totalMarks,
    earnedMarks,
    fullyReviewed,
    answers,
  }
}

/* -------------------------------------------------------------------------- */
/*  Mark a single question correct / wrong                                     */
/* -------------------------------------------------------------------------- */

export async function markQuestionCorrect(
  questionSubmissionId: string,
  isCorrect: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const updated = await db
      .update(questionSubmission)
      .set({ isCorrect })
      .where(eq(questionSubmission.id, questionSubmissionId))
      .returning({ id: questionSubmission.id })

    if (updated.length === 0) {
      return { success: false as const, error: 'Submission not found.' }
    }

    revalidatePath('/admin/exam-submissions')
    return { success: true as const }
  } catch (err) {
    console.error('markQuestionCorrect failed:', err)
    return { success: false as const, error: 'Failed to update.' }
  }
}