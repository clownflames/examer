"use server";

import crypto from "crypto";
import { db } from "@/db";
import {
  exams,
  examQuestions,
  examSubmission,
  questionMcqs,
  questionSubmission,
  internships,
  employeeDemand,
  payments,
} from "@/db/schema";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

// =====================================================
// TYPES
// =====================================================

export type ExamOption = {
  id: string;
  labelText: string;
};

export type ExamQuestionForAttempt = {
  id: string;
  name: string;
  details: string | null;
  marks: number;
  type: string;
  defaultText: string | null;
  options: ExamOption[];
};

export type ExamPreviousAttempt = {
  score: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  attemptCount: number;
};

export type ExamForAttempt = {
  id: string;
  name: string;
  orderNo: number;
  description: string | null;
  duration: number;
  totalMarks: number;
  passingMarks: number | null;
  internshipId: string;
  internshipName: string;
  demandName: string | null;
  questions: ExamQuestionForAttempt[];
  computedTotal: number;
  previousAttempt: ExamPreviousAttempt | null;
};

export type QuestionResult = {
  questionId: string;
  questionName: string;
  marks: number;
  isCorrect: boolean | null;
  yourAnswer: string | null;
  correctAnswer: string | null;
};

export type ExamResult = {
  submissionId: string;
  examName: string;
  internshipName: string;
  score: number;
  totalMarks: number;
  passingMarks: number | null;
  passed: boolean | null;
  correctCount: number;
  wrongCount: number;
  pendingReview: number;
  unanswered: number;
  totalQuestions: number;
  submittedAt: string;
  perQuestion: QuestionResult[];
};

export type SubmitExamResult =
  | { success: true; result: ExamResult }
  | { success: false; error: string };

// =====================================================
// HELPERS
// =====================================================

const MAX_ANSWER_LENGTH = 20000;

async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user?.id ?? null;
  } catch (error) {
    console.error("[exams] currentUserId error:", error);
    return null;
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
        eq(payments.status, "paid")
      )
    )
    .limit(1);
  return rows.length > 0;
}

type QuestionWithOptions = {
  id: string;
  name: string;
  details: string | null;
  marks: number;
  type: string;
  defaultText: string | null;
  options: { id: string; labelText: string; isCorrect: boolean }[];
};

/**
 * Loads questions + options. `includeAnswerKey` is only ever true on the
 * server (grading) — it must never be sent to the browser.
 */
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
    .orderBy(asc(examQuestions.createdAt), asc(examQuestions.id));

  if (questionRows.length === 0) return [];

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
    .orderBy(asc(questionMcqs.labelText));

  const optionsByQuestion = new Map<
    string,
    { id: string; labelText: string; isCorrect: boolean }[]
  >();
  for (const opt of optionRows) {
    const list = optionsByQuestion.get(opt.questionId) ?? [];
    // The answer key is stripped here — it never leaves the server.
    list.push({
      id: opt.id,
      labelText: opt.labelText,
      isCorrect: includeAnswerKey ? opt.isCorrect : false,
    });
    optionsByQuestion.set(opt.questionId, list);
  }

  return questionRows.map((q) => ({
    ...q,
    marks: q.marks ?? 0,
    options: optionsByQuestion.get(q.id) ?? [],
  }));
}

function readMeta(raw: unknown): {
  score: number | null;
  passed: boolean | null;
} {
  if (!raw || typeof raw !== "object") return { score: null, passed: null };
  const meta = raw as { score?: number; passed?: boolean | null };
  return {
    score: typeof meta.score === "number" ? meta.score : null,
    passed: typeof meta.passed === "boolean" ? meta.passed : null,
  };
}

// =====================================================
// LOAD EXAM FOR AN ATTEMPT (never leaks the answer key)
// =====================================================
export async function getExamForAttempt(
  examId: string
): Promise<ExamForAttempt | null> {
  const userId = await currentUserId();
  if (!userId || !examId) return null;

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
      .limit(1);

    if (!exam) return null;

    // Paid gate — no exam without a paid registration.
    if (!(await hasPaidAccess(userId, exam.internshipId))) return null;

    const questions = await loadQuestions(examId, false);

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
      .orderBy(desc(examSubmission.submittedAt));

    const latest = attempts[0] ?? null;
    const meta = latest ? readMeta(latest.answers) : { score: null, passed: null };

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
      questions: questions.map((q) => ({
        id: q.id,
        name: q.name,
        details: q.details,
        marks: q.marks ?? 0,
        type: q.type,
        defaultText: q.defaultText,
        options: q.options.map((o) => ({ id: o.id, labelText: o.labelText })),
      })),
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
    };
  } catch (error) {
    console.error("[exams] getExamForAttempt error:", error);
    return null;
  }
}

// =====================================================
// SUBMIT + GRADE (grading happens here, on the server)
// =====================================================
export async function submitExam(
  examId: string,
  rawAnswers: Record<string, string | null | undefined> | null | undefined
): Promise<SubmitExamResult> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!examId) return { success: false, error: "Invalid exam" };

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
      .limit(1);

    if (!exam) return { success: false, error: "Exam not found" };

    // Paid gate again — the page may have been opened a while ago.
    if (!(await hasPaidAccess(userId, exam.internshipId))) {
      return {
        success: false,
        error: "Your payment for this internship is not complete",
      };
    }

    const questions = await loadQuestions(examId, true);
    if (questions.length === 0) {
      return {
        success: false,
        error: "This exam has no questions yet. Please contact your examiner.",
      };
    }

    // ---- sanitise: only known question ids, known options, bounded length ----
    const clean: Record<string, string> = {};
    for (const q of questions) {
      const value = rawAnswers?.[q.id];
      if (typeof value !== "string") continue;
      const trimmed = value.slice(0, MAX_ANSWER_LENGTH);
      if (!trimmed.trim()) continue;

      if (q.type === "mcq") {
        const allowed = new Set(q.options.map((o) => o.id));
        if (allowed.has(trimmed)) clean[q.id] = trimmed;
      } else {
        clean[q.id] = trimmed;
      }
    }

    // ---- grade ----
    const submissionId = crypto.randomUUID();
    const now = new Date();

    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let pendingReview = 0;
    let unanswered = 0;
    let computedTotal = 0;

    const perQuestion: QuestionResult[] = [];
    const answerRows: (typeof questionSubmission.$inferInsert)[] = [];

    for (const q of questions) {
      const marks = q.marks ?? 0;
      computedTotal += marks;
      const given = clean[q.id] ?? null;

      if (q.type === "mcq") {
        const correctOption = q.options.find((o) => o.isCorrect) ?? null;
        const givenOption = given
          ? q.options.find((o) => o.id === given) ?? null
          : null;

        let isCorrect: boolean | null;
        if (!given) {
          unanswered += 1;
          isCorrect = null;
        } else if (correctOption && given === correctOption.id) {
          isCorrect = true;
          score += marks;
          correctCount += 1;
        } else {
          isCorrect = false;
          wrongCount += 1;
        }

        perQuestion.push({
          questionId: q.id,
          questionName: q.name,
          marks,
          isCorrect,
          yourAnswer: givenOption?.labelText ?? null,
          correctAnswer: correctOption?.labelText ?? null,
        });

        answerRows.push({
          id: crypto.randomUUID(),
          questionId: q.id,
          examSubmissionId: submissionId,
          optionId: given,
          text: null,
          isCorrect,
        });
      } else {
        // text / code / voice need a human examiner
        if (given) pendingReview += 1;
        else unanswered += 1;

        perQuestion.push({
          questionId: q.id,
          questionName: q.name,
          marks,
          isCorrect: null,
          yourAnswer: given,
          correctAnswer: null,
        });

        answerRows.push({
          id: crypto.randomUUID(),
          questionId: q.id,
          examSubmissionId: submissionId,
          optionId: null,
          text: given,
          isCorrect: null,
        });
      }
    }

    const passed =
      exam.passingMarks === null || exam.passingMarks === undefined
        ? null
        : pendingReview > 0 && score < exam.passingMarks
        ? null
        : score >= exam.passingMarks;

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
      });

      if (answerRows.length > 0) {
        await tx.insert(questionSubmission).values(answerRows);
      }
    });

    revalidatePath("/");
    revalidatePath("/internships");

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
    };
  } catch (error) {
    console.error("[exams] submitExam error:", error);
    return {
      success: false,
      error: "Could not submit your exam. Please try again.",
    };
  }
}
