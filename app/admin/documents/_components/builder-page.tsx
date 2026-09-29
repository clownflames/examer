'use client'

import { DocumentBuilder } from './document-builder'
import type { DocumentContent } from '../constants'

export function BuilderPage({
  mode,
  documentId,
  initialTitle,
  initialDescription,
  initialContent,
}: {
  mode: 'create' | 'edit'
  documentId?: string
  initialTitle?: string
  initialDescription?: string | null
  initialContent?: DocumentContent
}) {
  return (
    <DocumentBuilder
      mode={mode}
      documentId={documentId}
      initialTitle={initialTitle}
      initialDescription={initialDescription}
      initialContent={initialContent}
    />
  )
}