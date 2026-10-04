'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Ban,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

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

import {
  CertificateDrawerForm,
  type CertificateInitial,
} from './certificate-drawer-form'
import {
  deleteCertificate,
  setCertificateStatus,
  type CertificateRow,
} from './actions'
import type { InternshipOption, UserOption } from './constants'

export function CertificatesTable({
  data,
  page,
  totalPages,
  total,
  pageSize,
  users,
  internships,
}: {
  data: CertificateRow[]
  page: number
  totalPages: number
  total: number
  pageSize: number
  users: UserOption[]
  internships: InternshipOption[]
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
      {/* ---------- Top bar: create + filters ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <FilterTab label="All" value="all" />
          <FilterTab label="Issued" value="issued" />
          <FilterTab label="Revoked" value="revoked" />
        </div>

        <Drawer open={createOpen} onOpenChange={setCreateOpen}>
          <DrawerTrigger
            render={
              <Button>
                <Plus />
                Issue Certificate
              </Button>
            }
          />
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Issue Certificate</DrawerTitle>
              <DrawerDescription>
                Create a new certificate for a user. A unique verification code
                is generated automatically.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <CertificateDrawerForm
                mode="create"
                users={users}
                internships={internships}
                onSuccess={() => {
                  setCreateOpen(false)
                  router.refresh()
                }}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* ---------- Table ---------- */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Certificate No</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Issued To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issued At</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No certificates found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    row.status === 'revoked'
                      ? 'bg-destructive/10 border-l-2 border-l-destructive/60 backdrop-blur-sm transition-colors hover:bg-destructive/15'
                      : undefined
                  }
                >
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {row.certificateNo}
                  </TableCell>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{row.userName}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.userEmail}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === 'issued' ? 'default' : 'destructive'
                      }
                    >
                      {row.status === 'issued' ? 'Issued' : 'Revoked'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(row.issuedAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.expiresAt
                      ? format(new Date(row.expiresAt), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <StatusButton
                        id={row.id}
                        status={row.status}
                        certificateNo={row.certificateNo}
                      />
                      <EditCertificateButton
                        row={row}
                        users={users}
                        internships={internships}
                      />
                      <DeleteButton id={row.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ---------- Pagination ---------- */}
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

/* -------------------------------------------------------------------------- */
/*  Filter tab                                                                 */
/* -------------------------------------------------------------------------- */

function FilterTab({ label, value }: { label: string; value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('filter') ?? 'all'

  return (
    <Button
      variant={current === value ? 'secondary' : 'ghost'}
      size="sm"
      className="h-7"
      onClick={() => {
        const params = new URLSearchParams(searchParams.toString())
        if (value === 'all') params.delete('filter')
        else params.set('filter', value)
        params.delete('page')
        router.push(`${pathname}?${params.toString()}`)
      }}
    >
      {label}
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Revoke / Reinstate                                                          */
/* -------------------------------------------------------------------------- */

function StatusButton({
  id,
  status,
  certificateNo,
}: {
  id: string
  status: 'issued' | 'revoked'
  certificateNo: string
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  const next = status === 'issued' ? 'revoked' : 'issued'

  function handleToggle() {
    startTransition(async () => {
      const result = await setCertificateStatus(id, next)
      if (result.success) {
        toast.success(
          next === 'revoked'
            ? `Certificate ${certificateNo} revoked.`
            : `Certificate ${certificateNo} reinstated.`
        )
        router.refresh()
      } else {
        toast.error(result.error ?? 'Failed to update certificate.')
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={pending}
      aria-label={next === 'revoked' ? 'Revoke' : 'Reinstate'}
      title={next === 'revoked' ? 'Revoke' : 'Reinstate'}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : next === 'revoked' ? (
        <Ban className="h-4 w-4 text-amber-600" />
      ) : (
        <RotateCcw className="h-4 w-4 text-emerald-600" />
      )}
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Edit                                                                       */
/* -------------------------------------------------------------------------- */

function EditCertificateButton({
  row,
  users,
  internships,
}: {
  row: CertificateRow
  users: UserOption[]
  internships: InternshipOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  const initial: CertificateInitial = {
    id: row.id,
    userId: row.userId,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    internshipId: row.internshipId,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Edit" />
        }
      >
        <Pencil className="h-4 w-4" />
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit Certificate</DrawerTitle>
          <DrawerDescription>
            Update the details for{' '}
            <strong>{row.certificateNo}</strong>.
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <CertificateDrawerForm
            mode="edit"
            initial={initial}
            users={users}
            internships={internships}
            onSuccess={() => {
              setOpen(false)
              router.refresh()
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

function DeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCertificate(id)
      if (result.success) {
        toast.success('Certificate deleted.')
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
          <AlertDialogTitle>Delete this certificate?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The verification code will stop
            working immediately.
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