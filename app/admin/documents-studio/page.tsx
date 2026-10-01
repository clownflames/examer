import { StudioEditor } from './_components/studio-editor'

export default function NewStudioDocumentPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden">
      <StudioEditor />
    </div>
  )
}