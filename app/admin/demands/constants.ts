import { z } from 'zod'

export const PAGE_SIZE = 15

export const demandFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(120),
  iconUrl: z
    .string()
    .url('Must be a valid URL.')
    .optional()
    .nullable()
    .or(z.literal('')),
  description: z.string().max(20_000).optional().nullable(),
  keyFeatures: z
    .array(z.string().min(1, 'Feature cannot be empty.'))
    .max(20, 'You can add at most 20 features.')
    .default([]),
})

export type DemandInput = z.infer<typeof demandFormSchema>

export type DemandRow = {
  id: string
  name: string
  iconUrl: string | null
  description: string | null
  keyFeatures: string[] | null
  totalInternships: number
  totalTeams: number
  createdAt: string | null
}