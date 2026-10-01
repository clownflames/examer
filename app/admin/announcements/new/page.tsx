import { AnnouncementForm } from '../_components/announcement-form'

export const metadata = {
  title: 'New Announcement | Admin',
}

export default function NewAnnouncementPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          New announcement
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create a site-wide banner that appears to users.
        </p>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <AnnouncementForm mode="create" />
      </div>
    </div>
  )
}