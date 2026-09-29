import { getDocuments } from './actions'
import { PAGE_SIZE } from './constants'
import { DocumentsTable } from './documents-table'

export const metadata = {
  title: 'Documents | Admin',
  description: 'Design custom PDF documents and upload them to R2.',
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const query = (params.q ?? '').toString()

  const { data, totalPages, total } = await getDocuments(page, query)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Build custom PDFs — certificates, offer letters, and more.
        </p>
      </div>

      <DocumentsTable
        data={data}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        currentQuery={query}
      />
    </div>
  )
}