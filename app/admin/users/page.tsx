import { headers } from 'next/headers'
import { getUsers } from './actions'
import { UsersTable } from './users-table'
import { auth } from '@/lib/auth'

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const session = await auth.api.getSession({ headers: await headers() })
  const currentUserId = session?.user?.id ?? ''

  const { data, totalPages, total } = await getUsers(page)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
        <p className="text-muted-foreground text-sm">
          Manage all registered users. Create students or admins.
        </p>
      </div>

      <UsersTable
        data={data}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={15}
        currentUserId={currentUserId}
      />
    </div>
  )
}