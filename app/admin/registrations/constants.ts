export const PAGE_SIZE = 15

export type RegistrationRow = {
  id: string
  userId: string
  studentName: string
  studentEmail: string
  internshipId: string
  internshipName: string
  gainScore: number
  examsCompleted: number
  examsTotal: number
  createdAt: Date
}

export type StudentOption = {
  id: string
  name: string
  email: string
}

export type InternshipOption = {
  id: string
  name: string
}