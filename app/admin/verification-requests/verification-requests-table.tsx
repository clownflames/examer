'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  BadgeCheck,
  Ban,
  Check,
  Eye,
  Loader2,
  Mail,
  ShieldQuestion,
  X,
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
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

import { reviewVerificationRequest, type VerificationRequestRow } from './actions'
import type { VerificationFilter } from './constants'

export function VerificationRequestsTable({
  data,
  page,
  totalPages,
  total,
  pageSize,
  counts,
}: {
  data: VerificationRequestRow[]
  page: number
  totalPages: number
  total: number
  pageSize: number
  counts: Record<VerificationFilter, number>
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
      {/* ---------- Filter tabs ---------- */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border p-1">
        <FilterTab label="Pending" value="pending" count={counts.pending} />
        <FilterTab label="Approved" value="approved" count={counts.approved} />
        <FilterTab label="Rejected" value="rejected" count={counts.rejected} />
        <FilterTab label="All" value="all" count={counts.all} />
      </div>

      {/* ---------- Table ---------- */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requested By</TableHead>
              <TableHead>Verifier</TableHead>
              <TableHead>Certificate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <ShieldQuestion className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  No verification requests found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{row.userName}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.userEmail}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{row.verifierName}</p>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Mail className="h-3 w-3" />
                      {row.verifierEmail}
                    </p>
                    {row.organisation && (
                      <p className="text-muted-foreground text-xs">
                        {row.organisation}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.certificateNo ? (
                      <>
                        <p className="font-mono text-xs font-medium">
                          {row.certificateNo}
                        </p>
                        {row.certificateTitle && (
                          <p className="text-muted-foreground max-w-[180px] truncate text-xs">
                            {row.certificateTitle}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        No specific certificate
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(row.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ReviewButton request={row} />
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
/*  Status badge                                                               */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }: { status: VerificationRequestRow['status'] }) {
  if (status === 'approved') {
    return (
      <Badge className="gap-1">
        <Check className="h-3 w-3" />
        Approved
      </Badge>
    )
  }
  if (status === 'rejected') {
    return (
      <Badge variant="destructive" className="gap-1">
        <X className="h-3 w-3" />
        Rejected
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Loader2 className="h-3 w-3" />
      Pending
    </Badge>
  )
}

/* -------------------------------------------------------------------------- */
/*  Filter tab                                                                 */
/* -------------------------------------------------------------------------- */

function FilterTab({
  label,
  value,
  count,
}: {
  label: string
  value: VerificationFilter
  count: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = (searchParams.get('filter') as VerificationFilter) ?? 'pending'

  return (
    <Button
      variant={current === value ? 'secondary' : 'ghost'}
      size="sm"
      className="h-7 gap-1.5"
      onClick={() => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('filter', value)
        params.delete('page')
        router.push(`${pathname}?${params.toString()}`)
      }}
    >
      {label}
      <span className="text-muted-foreground text-[10px]">{count}</span>
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Review drawer                                                              */
/* -------------------------------------------------------------------------- */

function ReviewButton({ request }: { request: VerificationRequestRow }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [note, setNote] = React.useState(request.reviewNote ?? '')
  const [pending, startTransition] = React.useTransition()

  function handleReview(status: 'approved' | 'rejected') {
    startTransition(async () => {
      const result = await reviewVerificationRequest(request.id, {
        status,
        reviewNote: note.trim() || null,
      })

      if (result.success) {
        toast.success(
          status === 'approved' ? 'Request approved.' : 'Request rejected.'
        )
        setOpen(false)
        setNote('')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Something went wrong.')
      }
    })
  }

  const isReviewed = request.status !== 'pending'

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Review request" />
        }
      >
        <Eye className="h-4 w-4" />
      </DrawerTrigger>

      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>
            {isReviewed ? 'Request Details' : 'Review Request'}
          </DrawerTitle>
          <DrawerDescription>
            Requested by <strong>{request.userName}</strong> (
            {request.userEmail})
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
          {/* Details */}
          <div className="divide-y rounded-lg border">
            <DetailRow label="Verifier" value={request.verifierName} />
            <DetailRow label="Verifier email" value={request.verifierEmail} />
            {request.organisation && (
              <DetailRow label="Organisation" value={request.organisation} />
            )}
            <DetailRow
              label="Certificate"
              value={request.certificateNo ?? 'No specific certificate'}
              mono={Boolean(request.certificateNo)}
            />
            {request.certificateTitle && (
              <DetailRow label="Title" value={request.certificateTitle} />
            )}
            <DetailRow
              label="Requested on"
              value={format(new Date(request.createdAt), 'MMM d, yyyy h:mm a')}
            />
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-muted-foreground text-sm">Status</span>
              <StatusBadge status={request.status} />
            </div>
            {request.reviewedAt && (
              <DetailRow
                label="Reviewed on"
                value={format(new Date(request.reviewedAt), 'MMM d, yyyy h:mm a')}
              />
            )}
          </div>

          {/* User note */}
          {request.note && (
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
                User&apos;s note
              </p>
              <p className="text-sm whitespace-pre-wrap">{request.note}</p>
            </div>
          )}

          {/* Review note + actions */}
          <Field>
            <FieldLabel htmlFor="review-note">
              {isReviewed ? 'Your review note' : 'Review note (optional)'}
            </FieldLabel>
            <Textarea
              id="review-note"
              rows={4}
              placeholder="Add a note for the user…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isReviewed}
            />
          </Field>

          {!isReviewed && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleReview('rejected')}
                disabled={pending}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Ban className="h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => handleReview('approved')} disabled={pending}>
                <BadgeCheck className="h-4 w-4" />
                Approve
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-muted-foreground shrink-0 text-sm">{label}</span>
      <span
        className={
          mono
            ? 'text-right font-mono text-xs font-medium'
            : 'text-right text-sm font-medium'
        }
      >
        {value}
      </span>
    </div>
  )
}