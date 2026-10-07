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
  /**
   * Latest payment attempt for this registration. `unpaid` is a synthetic
   * status meaning no attempt at all was ever made.
   */
  paymentStatus: 'paid' | 'pending' | 'failed' | 'unpaid'
  /** When the payment was captured, if it ever was. */
  paidAt: Date | null
  /** What the attempt was for, and why it failed. */
  amountPaid: string | null
  failureReason: string | null
  /** Total attempts this student made — reveals retries at a glance. */
  paymentAttempts: number
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