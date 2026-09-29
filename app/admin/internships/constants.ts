import { z } from 'zod'

export const PAGE_SIZE = 15

/* -------------------- Validation schema (shared) -------------------- */

export const internshipFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(120),
  demandId: z.string().min(1, 'Please select a demand.'),
  description: z.string().max(20_000).optional().nullable(),
  lastSubmissionDate: z.coerce.date().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  jdUrl: z.string().url().optional().nullable().or(z.literal('')),
  price: z.coerce.number().nonnegative().optional().nullable(),
  sellingPrice: z.coerce.number().nonnegative().optional().nullable(),
  examinerName: z.string().max(120).optional().nullable(),
  examinerPhotoUrl: z.string().url().optional().nullable().or(z.literal('')),
  totalScore: z.coerce.number().int().positive().default(100),
})

export type InternshipInput = z.infer<typeof internshipFormSchema>

/* -------------------- Row / detail types -------------------- */

export type InternshipRow = {
  id: string
  name: string
  totalRegistrations: number
  demandId: string
  demandName: string | null
  isPublic: boolean
  createdAt: Date
}

export type InternshipDetail = {
  id: string
  name: string
  demandId: string
  description: string | null
  lastSubmissionDate: Date | null
  startDate: Date | null
  endDate: Date | null
  jdUrl: string | null
  price: string | null
  sellingPrice: string | null
  examinerName: string | null
  examinerPhotoUrl: string | null
  totalScore: number
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

export type Demand = { id: string; name: string }