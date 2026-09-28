'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { deleteInternship, type InternshipRow } from './actions'

export function InternshipsTable({
  data,
  page,
  totalPages,
  total,
  pageSize,
}: {
  data: InternshipRow[]
  page: number
  totalPages: number
  total: number
  pageSize: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`${pathname}?${params.toString()}`)
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Total Registrations</TableHead>
              <TableHead>Demand Name</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No internships found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {row.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {row.totalRegistrations}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.demandName ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(row.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        render={
                          <Link href={`/admin/internships/${row.id}/edit`} />
                        }
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteButton id={row.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
                <PaginationItem key={`ellipsis-${i}`}>
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

function DeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteInternship(id)
      if (result.success) {
        toast.success('Internship deleted.')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Failed to delete.')
      }
    })
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
          />
        }
      >
        <Trash2 className="text-destructive h-4 w-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this internship?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. All related registrations, exams,
            and teams will be removed.
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