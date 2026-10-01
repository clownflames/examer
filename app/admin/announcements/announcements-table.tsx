'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Eye,
  EyeOff,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

import {
  deleteAnnouncement,
  toggleAnnouncementActive,
} from './actions'
import { VARIANT_META, type AnnouncementRow } from './constants'

export function AnnouncementsTable({
  data,
  page,
  totalPages,
  total,
  pageSize,
  currentStatus,
  currentQuery,
}: {
  data: AnnouncementRow[]
  page: number
  totalPages: number
  total: number
  pageSize: number
  currentStatus: 'all' | 'active' | 'inactive'
  currentQuery: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = React.useState(currentQuery)
  const [deleteTarget, setDeleteTarget] =
    React.useState<AnnouncementRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [togglingId, setTogglingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    setSearchValue(currentQuery)
  }, [currentQuery])

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') params.delete(key)
      else params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  React.useEffect(() => {
    const handle = setTimeout(() => {
      if (searchValue === currentQuery) return
      updateParams({ q: searchValue.trim() || null, page: '1' })
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue])

  function goToPage(p: number) {
    updateParams({ page: String(p) })
  }

  async function handleToggle(id: string, isActive: boolean) {
    setTogglingId(id)
    const res = await toggleAnnouncementActive(id, !isActive)
    setTogglingId(null)
    if (res.success) {
      toast.success(res.isActive ? 'Activated' : 'Deactivated')
      router.refresh()
    } else {
      toast.error(res.error ?? 'Failed')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await deleteAnnouncement(deleteTarget.id)
    setDeleting(false)
    if (res.success) {
      toast.success('Deleted')
      setDeleteTarget(null)
      router.refresh()
    } else {
      toast.error(res.error ?? 'Delete failed')
    }
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const hasFilters = currentStatus !== 'all' || currentQuery.length > 0

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-muted/50 inline-flex items-center rounded-lg border p-0.5">
            {(
              [
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  updateParams({
                    status: opt.value === 'all' ? null : opt.value,
                    page: '1',
                  })
                }
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  currentStatus === opt.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() =>
                updateParams({ status: null, q: null, page: '1' })
              }
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}

          <div className="relative w-full md:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by title or content…"
              className="pl-9"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue('')}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                aria-label="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <Button
          render={<Link href="/admin/announcements/new" />}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New announcement
        </Button>
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <EmptyState filtered={hasFilters} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => {
                  const isToggling = togglingId === row.id
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex max-w-md flex-col">
                          <span className="line-clamp-1 text-sm font-medium">
                            {row.title}
                          </span>
                          <span
                            className="text-muted-foreground line-clamp-1 text-xs"
                            dangerouslySetInnerHTML={{ __html: row.content }}
                          />
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'capitalize',
                            VARIANT_META[row.variant].className
                          )}
                        >
                          {VARIANT_META[row.variant].label}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-xs">
                        {row.startsAt || row.endsAt ? (
                          <div className="flex flex-col">
                            {row.startsAt && (
                              <span>
                                From{' '}
                                {format(
                                  new Date(row.startsAt),
                                  'MMM d, yyyy'
                                )}
                              </span>
                            )}
                            {row.endsAt && (
                              <span>
                                To{' '}
                                {format(new Date(row.endsAt), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        ) : (
                          'Always'
                        )}
                      </TableCell>

                      <TableCell>
                        {row.isActive ? (
                          <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500">
                            <Eye className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <EyeOff className="h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleToggle(row.id, row.isActive)
                            }
                            disabled={isToggling}
                            aria-label={
                              row.isActive ? 'Deactivate' : 'Activate'
                            }
                            title={row.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {isToggling ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : row.isActive ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            render={
                              <Link
                                href={`/admin/announcements/${row.id}/edit`}
                                aria-label="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            }
                          />

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(row)}
                            aria-label="Delete"
                          >
                            <Trash2 className="text-destructive h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
            <p className="text-muted-foreground text-sm">
              Showing{' '}
              <span className="text-foreground font-medium">{from}</span>–
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
                      page <= 1
                        ? 'pointer-events-none opacity-50'
                        : undefined
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
        </>
      )}

      {/* Delete dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              <strong>{deleteTarget?.title}</strong>. Users will no longer see
              it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-20 text-center">
      <div className="bg-muted mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
        <Megaphone className="text-muted-foreground h-6 w-6" />
      </div>
      <p className="mb-1 text-sm font-semibold">
        {filtered ? 'No matching announcements' : 'No announcements yet'}
      </p>
      <p className="text-muted-foreground max-w-xs text-xs">
        {filtered
          ? 'Try a different search or filter.'
          : 'Create your first banner to inform users.'}
      </p>
      {!filtered && (
        <Button
          render={<Link href="/admin/announcements/new" />}
          className="mt-5 gap-2"
        >
          <Plus className="h-4 w-4" />
          New announcement
        </Button>
      )}
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