'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Check, Inbox, Pencil, Plus, Trash2, Users, X } from 'lucide-react'
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
import { TeamDrawerForm } from './team-drawer-form'
import { deleteTeam, updateTeamScore } from './actions'
import type {
  TeamRow,
  InternshipOption,
  DemandOption,
} from './constants'

export function TeamsTable({
  data,
  internshipOptions,
  demandOptions,
  page,
  totalPages,
  total,
  pageSize,
}: {
  data: TeamRow[]
  internshipOptions: InternshipOption[]
  demandOptions: DemandOption[]
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
          {total} {total === 1 ? 'team' : 'teams'} total
        </p>

        <Drawer open={createOpen} onOpenChange={setCreateOpen}>
          <DrawerTrigger >
            <Button>
              <Plus />
              Add New Team
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[92vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Create Team</DrawerTitle>
              <DrawerDescription>
                Name the team, pick an internship, and select students.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <TeamDrawerForm
                internshipOptions={internshipOptions}
                demandOptions={demandOptions}
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
              <TableHead>Name</TableHead>
              <TableHead>Internship</TableHead>
              <TableHead>Demand</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="w-[140px]">Score</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground h-24 text-center"
                >
                  No teams found. Click <strong>Add New Team</strong> to
                  create one.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {row.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.internshipName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.demandName}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Users className="text-muted-foreground h-3.5 w-3.5" />
                      {row.memberCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <EditableScore id={row.id} score={row.score} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(row.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Inbox"
                        title="Inbox"
                        render={<Link href={`/admin/teams/${row.id}/inbox`} />}
                      >
                        <Inbox className="h-4 w-4" />
                      </Button>
                      <DeleteTeamButton id={row.id} name={row.name} />
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
/*  Editable score                                                             */
/* -------------------------------------------------------------------------- */

function EditableScore({ id, score }: { id: string; score: number }) {
  const router = useRouter()
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(String(score))
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    setValue(String(score))
  }, [score])

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
    const result = await updateTeamScore({ id, score: parsed })
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
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="tabular-nums">
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
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

function DeleteTeamButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleDelete() {
    setPending(true)
    const result = await deleteTeam(id)
    setPending(false)

    if (result.success) {
      toast.success(`Team "${name}" deleted.`)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to delete.')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete"
          disabled={pending}
        >
          <Trash2 className="text-destructive h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this team?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <strong>{name}</strong> and all its
            members.
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