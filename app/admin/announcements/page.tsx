import { getAnnouncements } from './actions'
import { PAGE_SIZE } from './constants'
import { AnnouncementsTable } from './announcements-table'

export const metadata = {
  title: 'Announcements | Admin',
}

export default async function AnnouncementsPage({
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

  const status: 'all' | 'active' | 'inactive' =
    params.status === 'active' || params.status === 'inactive'
      ? params.status
      : 'all'

  const query = (params.q ?? '').toString()

  const { data, totalPages, total } = await getAnnouncements(page, {
    status,
    query,
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Announcements
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage site-wide banners shown to users.
        </p>
      </div>

      <AnnouncementsTable
        data={data}
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