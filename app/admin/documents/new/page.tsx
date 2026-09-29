import { BuilderPage } from '../_components/builder-page'

export const metadata = {
  title: 'New Document | Admin',
  description: 'Design a new PDF document.',
}

export default function NewDocumentPage() {
  return <BuilderPage mode="create" />
}