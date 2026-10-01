import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { listStudioDocuments } from '../actions'
import { StudioDocumentsTable } from './studio-documents-table'

export default async function StudioDocumentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const { data, totalPages, total } = await listStudioDocuments(page)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Document Studio
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Drag-and-drop page editor with PDF export. {total} document
            {total === 1 ? '' : 's'}.
          </p>
        </div>
        <Button
          render={<Link href="/admin/documents-studio" />}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New document
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-20 text-center">
          <p className="mb-1 text-sm font-semibold">No documents yet</p>
          <p className="text-muted-foreground max-w-xs text-xs">
            Create your first document in the studio.
          </p>
        </div>
      ) : (
        <StudioDocumentsTable
          data={data}
          totalPages={totalPages}
          page={page}
        />
      )}
    </div>
  )
}
