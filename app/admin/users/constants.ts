export const PAGE_SIZE = 15

export type UserRow = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: 'user' | 'admin'
  createdAt: Date
  totalRegistrations: number
}

/**
 * Everything the user drawer shows for one student. Assembled from several
 * tables, so it is fetched on demand when a row is opened rather than being
 * part of the paginated list.
 */
export type UserDetail = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: 'user' | 'admin'
  createdAt: Date
  profileCompletion: number

  /* ---- profile ---- */
  headline: string | null
  bio: string | null
  phone: string | null
  collegeName: string | null
  universityName: string | null
  degree: string | null
  branch: string | null
  rollNumber: string | null
  graduationYear: number | null
  cgpa: string | null
  city: string | null
  state: string | null
  country: string | null
  pincode: string | null
  githubUrl: string | null
  linkedinUrl: string | null
  portfolioUrl: string | null
  twitterUrl: string | null
  skills: string[]
  languages: string[]
  experience: {
    company: string
    role: string
    duration: string
    description?: string
  }[]
  projects: {
    name: string
    description?: string
    link?: string
    techStack?: string[]
  }[]
  achievements: string[]
  resumeFileName: string | null
  resumeSize: number | null
  resumeUploadedAt: Date | null

  /* ---- activity ---- */
  totalRegistrations: number
  paidCount: number
  unpaidCount: number
  totalPaidAmount: string | null
  examSubmissions: number
  teams: number

  /** One row per registration, newest first. */
  registrations: {
    id: string
    internshipId: string
    internshipName: string
    registeredAt: Date
    gainScore: number
    paymentStatus: 'paid' | 'pending' | 'failed' | 'unpaid'
    amountPaid: string | null
    paidAt: Date | null
    failureReason: string | null
    examsCompleted: number
    examsTotal: number
  }[]
}