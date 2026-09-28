'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { RegistrationDrawerForm } from './registration-drawer-form'
import {
  deleteRegistration,
  updateGainScore,
} from './actions'
import type { RegistrationRow } from './constants'

export function RegistrationsTable({
  data,
  page,
  totalPages,
  total,
  pageSize,
}: {
  data: RegistrationRow[]
  page: number
  totalPages: number
  total: number
  pageSize: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [createOpen, setCreateOpen] = React.useState(false)

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`${pathname}?${params.toString()}`)
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {total} {total === 1 ? 'registration' : 'registrations'} total
        </p>

        <Drawer open={createOpen} onOpenChange={setCreateOpen}>
          <DrawerTrigger
            render={
              <Button>
                <Plus />
                Register New
              </Button>
            }
          />
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Register Student</DrawerTitle>
              <DrawerDescription>
                Enroll a student into an internship.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <RegistrationDrawerForm
                onSuccess={() => {
                  setCreateOpen(false)
                  router.refresh()
                }}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Internship</TableHead>
              <TableHead className="w-[140px]">Gain Score</TableHead>
              <TableHead>Exams</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground h-24 text-center"
                >
                  No registrations found. Click{' '}
                  <strong>Register New</strong> to add one.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {row.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{row.studentName}</span>
                      <span className="text-muted-foreground text-xs">
                        {row.studentEmail}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.internshipName}
                  </TableCell>
                  <TableCell>
                    <EditableScore
                      id={row.id}
                      score={row.gainScore}
                    />
                  </TableCell>
                  <TableCell>
                    <ExamStatus
                      completed={row.examsCompleted}
                      total={row.examsTotal}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(row.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteRegistrationButton
                      id={row.id}
                      studentName={row.studentName}
                      internshipName={row.internshipName}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Showing <span className="text-foreground font-medium">{from}</span>–
          <span className="text-foreground font-medium">{to}</span> of{' '}
          <span className="text-foreground font-medium">{total}</span>
        </p>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (page > 1) goToPage(page - 1)
                }}
                className={
                  page <= 1 ? 'pointer-events-none opacity-50' : undefined
                }
              />
            </PaginationItem>

            {getPageNumbers(page, totalPages).map((p, i) =>
              p === '…' ? (
                <PaginationItem key={`e-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === page}
                    onClick={(e) => {
                      e.preventDefault()
                      goToPage(p as number)
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (page < totalPages) goToPage(page + 1)
                }}
                className={
                  page >= totalPages
                    ? 'pointer-events-none opacity-50'
                    : undefined
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('…')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('…')
  pages.push(total)
  return pages
}

/* -------------------------------------------------------------------------- */
/*  Inline editable score                                                      */
/* -------------------------------------------------------------------------- */

function EditableScore({ id, score }: { id: string; score: number }) {
  const router = useRouter()
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(String(score))
  const [pending, setPending] = React.useState(false)

  function cancel() {
    setValue(String(score))
    setEditing(false)
  }

  async function save() {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Score must be a non-negative number.')
      return
    }
    if (parsed === score) {
      setEditing(false)
      return
    }

    setPending(true)
    const result = await updateGainScore({ id, gainScore: parsed })
    setPending(false)

    if (result.success) {
      toast.success('Score updated.')
      setEditing(false)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to update.')
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="tabular-nums">
          {score}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Edit score"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-20"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') cancel()
        }}
        disabled={pending}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-green-600 hover:text-green-700"
        aria-label="Save"
        onClick={save}
        disabled={pending}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label="Cancel"
        onClick={cancel}
        disabled={pending}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Exam completion badge                                                      */
/* -------------------------------------------------------------------------- */

function ExamStatus({
  completed,
  total,
}: {
  completed: number
  total: number
}) {
  if (total === 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        No exams
      </Badge>
    )
  }
  if (completed === 0) {
    return <Badge variant="destructive">Not started</Badge>
  }
  if (completed >= total) {
    return (
      <Badge className="bg-green-600 text-white hover:bg-green-700">
        Completed
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      In progress ({completed}/{total})
    </Badge>
  )
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

function DeleteRegistrationButton({
  id,
  studentName,
  internshipName,
}: {
  id: string
  studentName: string
  internshipName: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleDelete() {
    setPending(true)
    const result = await deleteRegistration(id)
    setPending(false)

    if (result.success) {
      toast.success('Registration deleted.')
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to delete.')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete"
            disabled={pending}
          >
            <Trash2 className="text-destructive h-4 w-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this registration?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <strong>{studentName}</strong>&apos;s
            registration for <strong>{internshipName}</strong>. Related exam
            submissions will also be affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={pending}>
            {pending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}