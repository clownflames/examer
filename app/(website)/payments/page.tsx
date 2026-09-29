import { getMyPaymentsPaginated, getMyPaymentStats } from './actions'
import { PAGE_SIZE, type PaymentFilterStatus } from './constants'
import { PaymentsView } from './payments-view'

export const metadata = {
  title: 'Payment History | InternBird',
  description: 'View all your past transactions and their status.',
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    status?: string
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

  const [{ data, totalPages, total }, stats] = await Promise.all([
    getMyPaymentsPaginated(page, status),
    getMyPaymentStats(),
  ])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Payment History
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          All your transactions and their current status.
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
      />
    </div>
  )
}