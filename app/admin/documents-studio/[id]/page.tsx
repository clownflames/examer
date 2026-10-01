import { notFound } from 'next/navigation'

import { getStudioDocument } from '../actions'
import { StudioEditor } from '../_components/studio-editor'

export default async function EditStudioDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const doc = await getStudioDocument(id)

  if (!doc) notFound()

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden">
      <StudioEditor
        documentId={doc.id}
        initialTitle={doc.title}
        initialJson={doc.craftJson}
      />
    </div>
  )
}