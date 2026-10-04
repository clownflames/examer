import { z } from 'zod'

export const PAGE_SIZE = 15

/* -------------------- Validation schema (shared) -------------------- */

export const certificateFormSchema = z.object({
  userId: z.string().min(1, 'Please select a user.'),
  title: z.string().min(2, 'Title must be at least 2 characters.').max(160),
  description: z.string().max(20_000).optional().nullable(),
  imageUrl: z
    .string()
    .url('Must be a valid URL.')
    .optional()
    .nullable()
    .or(z.literal('')),
  internshipId: z.string().optional().nullable(),
  issuedAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
})

export type CertificateInput = z.infer<typeof certificateFormSchema>

/* -------------------- Row / detail types -------------------- */

export type CertificateRow = {
  id: string
  certificateNo: string
  title: string
  description: string | null
  imageUrl: string | null
  userId: string
  userName: string
  userEmail: string
  internshipId: string | null
  internshipName: string | null
  status: 'issued' | 'revoked'
  issuedAt: Date
  expiresAt: Date | null
  createdAt: Date
}

export type CertificateDetail = {
  id: string
  certificateNo: string
  userId: string
  title: string
  description: string | null
  imageUrl: string | null
  internshipId: string | null
  issuedAt: Date
  expiresAt: Date | null
  status: 'issued' | 'revoked'
  revokeReason: string | null
  createdAt: Date
  updatedAt: Date
}

export type UserOption = { id: string; name: string; email: string }
export type InternshipOption = { id: string; name: string }

export type CertificateFilter = 'all' | 'issued' | 'revoked'