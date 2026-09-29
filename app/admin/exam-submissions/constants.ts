export const PAGE_SIZE = 15

/* -------------------- Types -------------------- */

export type SubmissionRow = {
  id: string
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null

  examId: string
  examName: string
  internshipId: string
  internshipName: string

  submittedAt: Date | null
  createdAt: Date

  /** Total questions in the exam. */
  totalQuestions: number
  /** How many have isCorrect != null (reviewed). */
  reviewedCount: number
  /** True when all questions have been reviewed. */
  fullyReviewed: boolean
}

export type ExamOption = {
  id: string
  name: string
  internshipName: string
}

/* -------------------- Drawer types -------------------- */

export type SubmissionAnswer = {
  /** questionSubmission.id */
  id: string
  /** examQuestions.id */
  questionId: string
  questionName: string
  questionType: string // 'mcq' | 'text' | 'code' | 'voice'
  questionMarks: number
  questionDetails: string | null
  questionDefaultText: string | null

  /** The actual answer */
  answerText: string | null
  answerOptionId: string | null
  answerOptionLabel: string | null

  /** MCQ options (for showing all options & which was picked) */
  mcqOptions: {
    id: string
    labelText: string
    isCorrect: boolean
  }[]

  /** Admin marking */
  isCorrect: boolean | null
}

export type SubmissionDetail = {
  id: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
  examName: string
  internshipName: string
  submittedAt: Date | null
  createdAt: Date

  totalMarks: number
  earnedMarks: number
  fullyReviewed: boolean

  answers: SubmissionAnswer[]
}