import { notFound } from 'next/navigation'

import { getDocumentById } from '../../actions'
import { BuilderPage } from '../../_components/builder-page'

export const metadata = {
  title: 'Edit Document | Admin',
  description: 'Edit an existing PDF document.',
}

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const doc = await getDocumentById(id)

  if (!doc) {
    notFound()
  }

  return (
    <BuilderPage
      mode="edit"
      documentId={doc.id}
      initialTitle={doc.title}
      initialDescription={doc.description}
      initialContent={doc.content}
    />
  )
}