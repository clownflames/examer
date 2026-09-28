import { z } from 'zod'

export const QUESTION_TYPES = ['mcq', 'text', 'code', 'voice'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple Choice',
  text: 'Text Answer',
  code: 'Code',
  voice: 'Voice',
}

export const mcqOptionSchema = z.object({
  labelText: z.string().min(1, 'Option text cannot be empty.'),
  isCorrect: z.boolean(),
})

/**
 * IMPORTANT:
 * `options` is optional. Validation for MCQ requirements happens in
 * `.superRefine()` only when `type === 'mcq'`. This prevents non-MCQ
 * questions from failing validation due to empty default options.
 */
export const questionFormSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Question must be at least 2 characters.')
      .max(500),
    type: z.enum(QUESTION_TYPES),
    marks: z.coerce
      .number()
      .int()
      .positive('Marks must be a positive number.')
      .default(1),
    details: z.string().max(20_000).optional().nullable(),
    defaultText: z.string().max(20_000).optional().nullable(),
    options: z.array(mcqOptionSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== 'mcq') return

    const filled = (data.options ?? []).filter(
      (o) => o.labelText.trim().length > 0
    )

    if (filled.length < 2) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add at least 2 options.',
        path: ['options'],
      })
    }
    if (!filled.some((o) => o.isCorrect)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mark at least one option as correct.',
        path: ['options'],
      })
    }
  })

export type QuestionInput = z.infer<typeof questionFormSchema>

export type QuestionRow = {
  id: string
  examId: string
  name: string
  type: QuestionType
  marks: number
  details: string | null
  defaultText: string | null
  options: { id: string; labelText: string; isCorrect: boolean }[]
  createdAt: Date
}

export type ExamInfo = {
  id: string
  name: string
  internshipId: string
  internshipName: string
  totalMarks: number
}