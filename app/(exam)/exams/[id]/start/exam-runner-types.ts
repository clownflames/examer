/* -------------------------------------------------------------------------- */
/*  Answer shape                                                               */
/* -------------------------------------------------------------------------- */

export type AnswerValue = {
  /** Rich text HTML (for text/voice), plain string (for code), or null. */
  text?: string
  /** R2 public URL — only for voice questions. */
  audioUrl?: string
  /** Selected MCQ option id — only for mcq questions. */
  optionId?: string
}

export type Answers = Record<string, AnswerValue>

/* -------------------------------------------------------------------------- */
/*  Exam for attempt                                                           */
/* -------------------------------------------------------------------------- */

export type ExamOption = {
  id: string
  labelText: string
}

export type ExamQuestionForAttempt = {
  id: string
  name: string
  details: string | null
  marks: number
  type: string // 'mcq' | 'text' | 'code' | 'voice'
  defaultText: string | null
  options: ExamOption[]
}

export type ExamPreviousAttempt = {
  score: number | null
  passed: boolean | null
  submittedAt: string | null
  attemptCount: number
}

export type ExamForAttempt = {
  id: string
  name: string
  orderNo: number
  description: string | null
  duration: number
  totalMarks: number
  passingMarks: number | null
  internshipId: string
  internshipName: string
  demandName: string | null
  questions: ExamQuestionForAttempt[]
  computedTotal: number
  previousAttempt: ExamPreviousAttempt | null
}

/* -------------------------------------------------------------------------- */
/*  Result                                                                     */
/* -------------------------------------------------------------------------- */

export type QuestionResult = {
  questionId: string
  questionName: string
  marks: number
  isCorrect: boolean | null
  yourAnswer: string | null
  correctAnswer: string | null
}

export type ExamResult = {
  submissionId: string
  examName: string
  internshipName: string
  score: number
  totalMarks: number
  passingMarks: number | null
  passed: boolean | null
  correctCount: number
  wrongCount: number
  pendingReview: number
  unanswered: number
  totalQuestions: number
  submittedAt: string
  perQuestion: QuestionResult[]
}

export type SubmitExamResult =
  | { success: true; result: ExamResult }
  | { success: false; error: string }