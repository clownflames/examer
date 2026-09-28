import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getDemands, getInternshipById } from '../../actions'
import { InternshipForm } from '../../internship-form'

export default async function EditInternshipPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [internship, demands] = await Promise.all([
    getInternshipById(id),
    getDemands(),
  ])

  if (!internship) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href="/admin/internships" />}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Edit Internship
          </h2>
          <p className="text-muted-foreground text-sm">
            Update the details for <span className="font-medium">{internship.name}</span>.
          </p>
        </div>
      </div>

      <InternshipForm
        demands={demands}
        mode="edit"
        initial={internship}
      />
    </div>
  )
}