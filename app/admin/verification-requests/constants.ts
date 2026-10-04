import { z } from 'zod'

export const PAGE_SIZE = 15

/* -------------------- Row / detail types -------------------- */

export type VerificationRequestRow = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  userId: string
  userName: string
  userEmail: string
  certificateId: string | null
  certificateNo: string | null
  certificateTitle: string | null
  verifierName: string
  verifierEmail: string
  organisation: string | null
  note: string | null
  reviewNote: string | null
  reviewedAt: Date | null
  createdAt: Date
}

export type VerificationFilter = 'pending' | 'approved' | 'rejected' | 'all'

export const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNote: z.string().max(2000).optional().nullable(),
})

export type ReviewInput = z.infer<typeof reviewSchema>