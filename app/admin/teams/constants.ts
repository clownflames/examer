import { z } from 'zod'

export const PAGE_SIZE = 15

export const teamFormSchema = z.object({
  name: z.string().min(2, 'Team name must be at least 2 characters.').max(120),
  internshipId: z.string().min(1, 'Please select an internship.'),
  demandId: z.string().min(1, 'Please select a demand.'),
  memberIds: z
    .array(z.string())
    .min(1, 'Add at least one student to the team.'),
})

export type TeamInput = z.infer<typeof teamFormSchema>

export type TeamRow = {
  id: string
  name: string
  internshipId: string
  internshipName: string
  demandId: string
  demandName: string
  memberCount: number
  score: number
  createdAt: Date
}

export type InternshipOption = { id: string; name: string; demandId: string }
export type DemandOption = { id: string; name: string }

export type StudentCandidate = {
  registrationId: string
  userId: string
  name: string
  email: string
  image: string | null
  gainScore: number
  examsCompleted: number
  examsTotal: number
  registeredAt: Date
  alreadyInTeam: boolean
  teamId: string | null
  teamName: string | null
}

export type TeamMemberRow = {
  id: string
  userId: string
  name: string
  email: string
  image: string | null
  joinedAt: Date
}