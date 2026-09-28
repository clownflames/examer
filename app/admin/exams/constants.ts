import { z } from 'zod'

export const PAGE_SIZE = 15

export const examFormSchema = z.object({
  internshipId: z.string().min(1, 'Please select an internship.'),
  orderNo: z.coerce.number().int().positive('Order must be a positive number.'),
  name: z.string().min(2, 'Name must be at least 2 characters.').max(120),
  description: z.string().max(20_000).optional().nullable(),
  duration: z.coerce
    .number()
    .int()
    .positive('Duration must be greater than 0.')
    .max(600, 'Duration cannot exceed 600 minutes.'),
  totalMarks: z.coerce
    .number()
    .int()
    .positive('Total marks must be positive.')
    .default(100),
  passingMarks: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .nullable(),
})

export type ExamInput = z.infer<typeof examFormSchema>

export type ExamRow = {
  id: string
  name: string
  internshipId: string
  internshipName: string
  orderNo: number
  duration: number
  totalMarks: number
  passingMarks: number | null
  questionCount: number
  createdAt: Date
}

export type InternshipOption = { id: string; name: string }