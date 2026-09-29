import { getAdminPayments, getAdminPaymentStats } from './actions'
import { PAGE_SIZE, type PaymentFilterStatus } from './constants'
import { PaymentsView } from './payments-view'

export const metadata = {
  title: 'Payments | Admin',
  description: 'View and manage all payments.',
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    status?: string
    q?: string
  }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const status: PaymentFilterStatus =
    params.status === 'paid' ||
    params.status === 'pending' ||
    params.status === 'failed'
      ? params.status
      : 'all'
  const query = (params.q ?? '').toString()

  const [{ data, totalPages, total }, stats] = await Promise.all([
    getAdminPayments(page, status, query),
    getAdminPaymentStats(),
  ])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Search by student, email, internship, or Razorpay IDs.
        </p>
      </div>

      <PaymentsView
        data={data}
        stats={stats}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        currentStatus={status}
        currentQuery={query}
      />
    </div>
  )
}