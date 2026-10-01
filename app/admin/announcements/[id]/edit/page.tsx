import { notFound } from 'next/navigation'

import { getAnnouncementById } from '../../actions'
import { AnnouncementForm } from '../../_components/announcement-form'

export const metadata = {
  title: 'Edit Announcement | Admin',
}

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const doc = await getAnnouncementById(id)

  if (!doc) notFound()

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit announcement
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Update content, behaviour, or schedule.
        </p>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <AnnouncementForm mode="edit" initial={doc} />
      </div>
    </div>
  )
}