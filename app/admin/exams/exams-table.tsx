'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Clock,
  Eye,
  EyeOff,
  FileQuestion,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { ExamDrawerForm } from './exam-drawer-form'
import { ExamQuestionsDrawer } from './exam-questions-drawer'
import { deleteExam, toggleExamVisibility } from './actions'
import type { ExamRow, InternshipOption } from './constants'

/* -------------------------------------------------------------------------- */
/*  Table                                                                      */
/* -------------------------------------------------------------------------- */

export function ExamsTable({
  data,
  internshipOptions,
  page,
  totalPages,
  total,
  pageSize,
}: {
  data: ExamRow[]
  internshipOptions: InternshipOption[]
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
          {total} {total === 1 ? 'exam' : 'exams'} total
        </p>

        <Drawer open={createOpen} onOpenChange={setCreateOpen}>
          <DrawerTrigger
            render={
              <Button>
                <Plus />
                Create Exam
              </Button>
            }
          />
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Create New Exam</DrawerTitle>
              <DrawerDescription>
                Set up an exam for an internship. Add questions after saving.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <ExamDrawerForm
                mode="create"
                internshipOptions={internshipOptions}
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
              <TableHead className="w-[80px]">Order</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Internship</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Marks</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-muted-foreground h-24 text-center"
                >
                  No exams found. Click <strong>Create Exam</strong> to add one.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    row.isPublic
                      ? undefined
                      : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/30'
                  }
                >
                  <TableCell>
                    <Badge variant="outline" className="tabular-nums">
                      #{row.orderNo}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.internshipName}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Clock className="text-muted-foreground h-3.5 w-3.5" />
                      {row.duration} min
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span className="font-medium">{row.totalMarks} total</span>
                      {row.passingMarks != null && (
                        <span className="text-muted-foreground text-xs">
                          pass ≥ {row.passingMarks}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <QuestionsButton
                      examId={row.id}
                      examName={row.name}
                      questionCount={row.questionCount}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.isPublic ? 'default' : 'outline'}>
                      {row.isPublic ? 'Public' : 'Private'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(row.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ToggleVisibilityButton
                        id={row.id}
                        isPublic={row.isPublic}
                      />
                      <EditExamButton
                        examId={row.id}
                        internshipOptions={internshipOptions}
                      />
                      <DeleteExamButton id={row.id} name={row.name} />
                    </div>
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

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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
/*  Questions button                                                           */
/* -------------------------------------------------------------------------- */

function QuestionsButton({
  examId,
  examName,
  questionCount,
}: {
  examId: string
  examName: string
  questionCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1 px-2">
            <FileQuestion className="h-3.5 w-3.5" />
            {questionCount}
          </Button>
        }
      />
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Questions</DrawerTitle>
          <DrawerDescription>
            Manage all questions for <strong>{examName}</strong>.
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <ExamQuestionsDrawer examId={examId} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/* -------------------------------------------------------------------------- */
/*  Edit drawer                                                                */
/* -------------------------------------------------------------------------- */

function EditExamButton({
  examId,
  internshipOptions,
}: {
  examId: string
  internshipOptions: InternshipOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit Exam</DrawerTitle>
          <DrawerDescription>
            Update the exam details and settings.
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          {open ? (
            <ExamDrawerForm
              mode="edit"
              examId={examId}
              internshipOptions={internshipOptions}
              onSuccess={() => {
                setOpen(false)
                router.refresh()
              }}
            />
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/* -------------------------------------------------------------------------- */
/*  Toggle Visibility Button                                                   */
/* -------------------------------------------------------------------------- */

function ToggleVisibilityButton({
  id,
  isPublic,
}: {
  id: string
  isPublic: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleToggle() {
    setPending(true)
    const result = await toggleExamVisibility(id, !isPublic)
    setPending(false)

    if (result.success) {
      toast.success(
        result.isPublic
          ? 'Exam is now public.'
          : 'Exam is now private.'
      )
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to update visibility.')
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={pending}
      aria-label={isPublic ? 'Make private' : 'Make public'}
      title={isPublic ? 'Make private' : 'Make public'}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isPublic ? (
        <Eye className="h-4 w-4 text-emerald-600" />
      ) : (
        <EyeOff className="text-muted-foreground h-4 w-4" />
      )}
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Delete dialog                                                              */
/* -------------------------------------------------------------------------- */

function DeleteExamButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleDelete() {
    setPending(true)
    const result = await deleteExam(id)
    setPending(false)

    if (result.success) {
      toast.success(`Exam "${name}" deleted.`)
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
          <AlertDialogTitle>Delete this exam?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <strong>{name}</strong>. All questions
            and submissions attached to it will also be deleted.
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