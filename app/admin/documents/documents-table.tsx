'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  Loader2,
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

import { deleteDocument, duplicateDocument } from './actions'
import type { DocumentRow } from './constants'

export function DocumentsTable({
  data,
  page,
  totalPages,
  total,
  pageSize,
  currentQuery,
}: {
  data: DocumentRow[]
  page: number
  totalPages: number
  total: number
  pageSize: number
  currentQuery: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = React.useState(currentQuery)
  const [deleteTarget, setDeleteTarget] = React.useState<DocumentRow | null>(
    null
  )
  const [deleting, setDeleting] = React.useState(false)
  const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null)

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

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await deleteDocument(deleteTarget.id)
    setDeleting(false)
    if (res.success) {
      toast.success('Document deleted')
      setDeleteTarget(null)
      router.refresh()
    } else {
      toast.error(res.error ?? 'Delete failed')
    }
  }

  async function handleDuplicate(id: string) {
    setDuplicatingId(id)
    const res = await duplicateDocument(id)
    setDuplicatingId(null)
    if (res.success) {
      toast.success('Document duplicated')
      router.refresh()
    } else {
      toast.error(res.error ?? 'Duplicate failed')
    }
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-80">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search documents…"
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

        <Button render={<Link href="/admin/documents/new" />} className="gap-2">
          <Plus className="h-4 w-4" />
          New document
        </Button>
      </div>

      {/* Content */}
      {data.length === 0 ? (
        <EmptyState filtered={currentQuery.length > 0} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>PDF</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((doc) => {
                  const isDuplicating = duplicatingId === doc.id
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {doc.title}
                          </span>
                          {doc.description && (
                            <span className="text-muted-foreground line-clamp-1 text-xs">
                              {doc.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.pdfUrl ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500"
                          >
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Not generated</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {format(
                          new Date(doc.updatedAt),
                          'MMM d, yyyy · h:mm a'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {doc.pdfUrl && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                render={
                                  <a
                                    href={doc.pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="View PDF"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                render={
                                  <a
                                    href={doc.pdfUrl}
                                    download={`${doc.title}.pdf`}
                                    aria-label="Download"
                                  >
                                    <Download className="h-4 w-4" />
                                  </a>
                                }
                              />
                            </>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDuplicate(doc.id)}
                            disabled={isDuplicating}
                            aria-label="Duplicate"
                            title="Duplicate"
                          >
                            {isDuplicating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            render={
                              <Link
                                href={`/admin/documents/${doc.id}/edit`}
                                aria-label="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(doc)}
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
              Showing <span className="text-foreground font-medium">{from}</span>
              –<span className="text-foreground font-medium">{to}</span> of{' '}
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
        </>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.title}</strong>{' '}
              and its generated PDF from R2.
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
        <FileSignature className="text-muted-foreground h-6 w-6" />
      </div>
      <p className="mb-1 text-sm font-semibold">
        {filtered ? 'No matching documents' : 'No documents yet'}
      </p>
      <p className="text-muted-foreground max-w-xs text-xs">
        {filtered
          ? 'Try a different search term.'
          : 'Create your first document — certificates, offer letters, or anything custom.'}
      </p>
      {!filtered && (
        <Button
          render={<Link href="/admin/documents/new" />}
          className="mt-5 gap-2"
        >
          <Plus className="h-4 w-4" />
          New document
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