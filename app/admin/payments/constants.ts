export const PAGE_SIZE = 20

export type PaymentStatus = 'pending' | 'paid' | 'failed'
export type PaymentFilterStatus = 'all' | 'pending' | 'paid' | 'failed'

/* -------------------- Row (list) -------------------- */

export type AdminPaymentRow = {
  id: string

  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null

  internshipId: string
  internshipName: string
  demandName: string | null

  registrationId: string

  amount: number
  currency: string
  status: PaymentStatus

  razorpayOrderId: string | null
  razorpayPaymentId: string | null

  createdAt: string
  paidAt: string | null
}

/* -------------------- Stats -------------------- */

export type AdminPaymentStats = {
  totalRevenue: number
  paidCount: number
  pendingCount: number
  failedCount: number
  uniqueStudents: number
}

/* -------------------- Detail (drawer) -------------------- */

export type AdminPaymentDetail = AdminPaymentRow & {
  razorpaySignature: string | null
  failureReason: string | null
  updatedAt: string

  /** Registration snapshot */
  coverLetter: string | null
  resumeUrl: string | null

  /** User snapshot */
  userRole: string | null
  userCreatedAt: string | null
}