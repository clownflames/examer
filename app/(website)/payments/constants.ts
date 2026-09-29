export const PAGE_SIZE = 10

/* -------------------- Types -------------------- */

export type PaymentStatus = 'pending' | 'paid' | 'failed'

export type PaymentRow = {
  id: string
  internshipId: string
  internshipName: string
  demandName: string | null

  amount: number
  currency: string
  status: PaymentStatus

  createdAt: string
  paidAt: string | null

  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  failureReason: string | null
}

export type PaymentStats = {
  totalSpent: number
  paidCount: number
  pendingCount: number
  failedCount: number
}

export type PaymentFilterStatus = 'all' | 'paid' | 'pending' | 'failed'