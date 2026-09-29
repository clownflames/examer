import { getMediaAssets } from './actions'
import { PAGE_SIZE, type MediaFilter } from './constants'
import { MediaLibrary } from './media-library'

export const metadata = {
  title: 'Media Library | Admin',
  description: 'Upload and manage images stored in R2.',
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    filter?: string
    q?: string
  }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const filter: MediaFilter =
    params.filter === 'mine' ||
    params.filter === 'admin' ||
    params.filter === 'user'
      ? params.filter
      : 'all'
  const query = (params.q ?? '').toString()

  const { data, totalPages, total } = await getMediaAssets(
    page,
    filter,
    query
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Media Library
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload images to reuse them in documents. Files are stored on
          Cloudflare R2.
        </p>
      </div>

      <MediaLibrary
        data={data}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        currentFilter={filter}
        currentQuery={query}
      />
    </div>
  )
}