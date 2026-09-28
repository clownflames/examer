import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getDemands } from '../actions'
import { InternshipForm } from '../internship-form'

export default async function NewInternshipPage() {
  const demands = await getDemands()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/admin/internships" />}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Add New Internship
          </h2>
          <p className="text-muted-foreground text-sm">
            Fill in the details below to create a new internship.
          </p>
        </div>
      </div>

      <InternshipForm demands={demands} mode="create" />
    </div>
  )
}