import { z } from 'zod'

export const PAGE_SIZE = 15

/* -------------------- Validation schema (shared) -------------------- */

export const offerLetterFormSchema = z.object({
  userId: z.string().min(1, 'Please select a user.'),
  internshipId: z.string().optional().nullable(),

  companyName: z
    .string()
    .min(2, 'Company name must be at least 2 characters.')
    .max(160),
  designation: z
    .string()
    .min(2, 'Designation must be at least 2 characters.')
    .max(160),
  location: z.string().max(160).optional().nullable(),
  compensation: z.string().max(80).optional().nullable(),
  joiningDate: z.coerce.date().optional().nullable(),
  duration: z.string().max(80).optional().nullable(),
  body: z.string().max(50_000).optional().nullable(),

  pdfUrl: z
    .string()
    .url('Must be a valid URL.')
    .optional()
    .nullable()
    .or(z.literal('')),

  issuedAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  status: z
    .enum(['draft', 'issued', 'accepted', 'declined', 'revoked'])
    .default('draft'),
})

export type OfferLetterInput = z.infer<typeof offerLetterFormSchema>

/* -------------------- Row / detail types -------------------- */

export type OfferLetterRow = {
  id: string
  offerNo: string
  companyName: string
  designation: string
  location: string | null
  compensation: string | null
  status: OfferLetterStatus
  userId: string
  userName: string
  userEmail: string
  internshipId: string | null
  internshipName: string | null
  issuedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}

export type OfferLetterDetail = {
  id: string
  offerNo: string
  userId: string
  internshipId: string | null
  companyName: string
  designation: string
  location: string | null
  compensation: string | null
  joiningDate: Date | null
  duration: string | null
  body: string | null
  pdfUrl: string | null
  issuedAt: Date | null
  expiresAt: Date | null
  status: OfferLetterStatus
  respondedAt: Date | null
  declineReason: string | null
  revokeReason: string | null
  createdAt: Date
  updatedAt: Date
}

export type OfferLetterStatus =
  | 'draft'
  | 'issued'
  | 'accepted'
  | 'declined'
  | 'revoked'

export type UserOption = { id: string; name: string; email: string }
export type InternshipOption = { id: string; name: string }

/** Statuses jinke liye row-level action buttons dikhte hain */
export const ACTIVE_STATUSES = ['draft', 'issued'] as const

export const STATUS_META: Record<
  OfferLetterStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  draft: { label: 'Draft', variant: 'outline' },
  issued: { label: 'Issued', variant: 'default' },
  accepted: { label: 'Accepted', variant: 'secondary' },
  declined: { label: 'Declined', variant: 'destructive' },
  revoked: { label: 'Revoked', variant: 'destructive' },
}

export type OfferLetterFilter =
  | 'all'
  | 'draft'
  | 'issued'
  | 'accepted'
  | 'declined'
  | 'revoked'