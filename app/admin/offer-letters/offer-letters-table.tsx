'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Ban,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Send,
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
  OfferLetterDrawerForm,
  type OfferLetterInitial,
} from './offer-letter-drawer-form'
import {
  deleteOfferLetter,
  getOfferLetterById,
  setOfferLetterStatus,
  type OfferLetterDetail,
  type OfferLetterRow,
} from './actions'
import {
  ACTIVE_STATUSES,
  STATUS_META,
  type InternshipOption,
  type OfferLetterFilter,
  type OfferLetterStatus,
  type UserOption,
} from './constants'

const FILTERS: { label: string; value: OfferLetterFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Issued', value: 'issued' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Declined', value: 'declined' },
  { label: 'Revoked', value: 'revoked' },
]

export function OfferLettersTable({
  data,
  page,
  totalPages,
  total,
  pageSize,
  users,
  internships,
}: {
  data: OfferLetterRow[]
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
      {/* ---------- Filters + create ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border p-1">
          {FILTERS.map((f) => (
            <FilterTab key={f.value} label={f.label} value={f.value} />
          ))}
        </div>

        <Drawer open={createOpen} onOpenChange={setCreateOpen}>
          <DrawerTrigger
            render={
              <Button>
                <Plus />
                New Offer Letter
              </Button>
            }
          />
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>New Offer Letter</DrawerTitle>
              <DrawerDescription>
                Create an offer letter for a user. A unique reference code is
                generated automatically.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <OfferLetterDrawerForm
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
              <TableHead>Offer No</TableHead>
              <TableHead>Company / Role</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No offer letters found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    row.status === 'revoked' || row.status === 'declined'
                      ? 'bg-destructive/10 border-l-2 border-l-destructive/60 backdrop-blur-sm transition-colors hover:bg-destructive/15'
                      : undefined
                  }
                >
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {row.offerNo}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{row.companyName}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.designation}
                      {row.location && ` · ${row.location}`}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{row.userName}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.userEmail}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_META[row.status].variant}>
                      {STATUS_META[row.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.expiresAt
                      ? format(new Date(row.expiresAt), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <StatusActions id={row.id} status={row.status} offerNo={row.offerNo} />
                      <EditOfferLetterButton
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

function FilterTab({ label, value }: { label: string; value: OfferLetterFilter }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = (searchParams.get('filter') as OfferLetterFilter) ?? 'all'

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
/*  Status actions — issue / revoke / reinstate                                 */
/* -------------------------------------------------------------------------- */

function StatusActions({
  id,
  status,
  offerNo,
}: {
  id: string
  status: OfferLetterStatus
  offerNo: string
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  const isActive = (ACTIVE_STATUSES as readonly string[]).includes(status)

  function apply(next: OfferLetterStatus) {
    startTransition(async () => {
      const result = await setOfferLetterStatus(id, next)
      if (result.success) {
        toast.success(`Offer letter ${offerNo} marked as ${STATUS_META[next].label.toLowerCase()}.`)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Failed to update offer letter.')
      }
    })
  }

  if (pending) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label="Updating">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  if (status === 'revoked' || status === 'declined') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => apply('draft')}
        aria-label="Revert to draft"
        title="Revert to draft"
      >
        <RotateCcw className="h-4 w-4 text-emerald-600" />
      </Button>
    )
  }

  if (status === 'accepted') {
    // Accepted letters ko revert karne ke liye sirf draft
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => apply('draft')}
        aria-label="Revert to draft"
        title="Revert to draft"
      >
        <RotateCcw className="h-4 w-4 text-muted-foreground" />
      </Button>
    )
  }

  return (
    <>
      {status === 'draft' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => apply('issued')}
          aria-label="Issue to user"
          title="Issue to user"
        >
          <Send className="h-4 w-4 text-emerald-600" />
        </Button>
      )}
      {isActive && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => apply('revoked')}
          aria-label="Revoke"
          title="Revoke"
        >
          <Ban className="h-4 w-4 text-amber-600" />
        </Button>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Edit                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * List query body/pdfUrl/joningDate ko nahi laata (body bada HTML hai),
 * isliye drawer khulte hi full detail fetch karte hain — warna save karne
 * par ye fields wipe ho jaayengi.
 */
function EditOfferLetterButton({
  row,
  users,
  internships,
}: {
  row: OfferLetterRow
  users: UserOption[]
  internships: InternshipOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [detail, setDetail] = React.useState<OfferLetterDetail | null>(null)

  async function handleOpenChange(next: boolean) {
    setOpen(next)

    if (next && !detail) {
      setLoading(true)
      const full = await getOfferLetterById(row.id)
      setDetail(full)
      setLoading(false)
    }
  }

  const initial: OfferLetterInitial | null = detail
    ? {
        id: detail.id,
        userId: detail.userId,
        internshipId: detail.internshipId,
        companyName: detail.companyName,
        designation: detail.designation,
        location: detail.location,
        compensation: detail.compensation,
        joiningDate: detail.joiningDate,
        duration: detail.duration,
        body: detail.body,
        pdfUrl: detail.pdfUrl,
        issuedAt: detail.issuedAt,
        expiresAt: detail.expiresAt,
        status: detail.status,
      }
    : null

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger
        render={<Button variant="ghost" size="icon" aria-label="Edit" />}
      >
        <Pencil className="h-4 w-4" />
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit Offer Letter</DrawerTitle>
          <DrawerDescription>
            Update the details for <strong>{row.offerNo}</strong>.
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading details…
            </div>
          )}

          {!loading && initial && (
            <OfferLetterDrawerForm
              mode="edit"
              initial={initial}
              users={users}
              internships={internships}
              onSuccess={() => {
                setOpen(false)
                // Detail stale ho gaya — agli baar dobara fetch hoga
                setDetail(null)
                router.refresh()
              }}
            />
          )}
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
      const result = await deleteOfferLetter(id)
      if (result.success) {
        toast.success('Offer letter deleted.')
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
          <AlertDialogTitle>Delete this offer letter?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The reference code will stop working
            immediately.
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