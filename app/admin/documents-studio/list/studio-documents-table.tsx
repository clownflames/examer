'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, Download, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  deleteStudioDocument,
  duplicateStudioDocument,
  getStudioDocument,
} from '../actions'
import {
  PAGE_PRESETS,
  type PageSetup,
  type StudioDocumentRow,
} from '../constants'
import { readPageSetup } from '../_lib/craft'
import { downloadBlob, renderPdfBlob, slugify } from '../_pdf/export-pdf'

export function StudioDocumentsTable({
  data,
  totalPages,
  page,
}: {
  data: StudioDocumentRow[]
  totalPages: number
  page: number
}) {
  const router = useRouter()
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<StudioDocumentRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  async function refresh() {
    router.refresh()
  }

  async function handleDuplicate(doc: StudioDocumentRow) {
    setBusyId(doc.id)
    try {
      const res = await duplicateStudioDocument(doc.id)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Document duplicated')
      router.push(`/admin/documents-studio/${res.id}`)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDownload(doc: StudioDocumentRow) {
    setBusyId(doc.id)
    try {
      // Always rebuild from the stored source so the download matches the
      // latest edit rather than a possibly-stale exported copy.
      const detail = await getStudioDocument(doc.id)
      if (!detail) {
        toast.error('Document not found')
        return
      }
      const blob = await renderPdfBlob(detail.craftJson, detail.title)
      downloadBlob(blob, `${slugify(detail.title)}.pdf`)
      toast.success('PDF downloaded')
    } catch (err) {
      console.error(err)
      toast.error('Could not build the PDF')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await deleteStudioDocument(deleteTarget.id)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Document deleted')
      setDeleteTarget(null)
      await refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="hidden md:table-cell">Page</TableHead>
              <TableHead className="hidden lg:table-cell">PDF</TableHead>
              <TableHead className="hidden sm:table-cell">Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <Link
                    href={`/admin/documents-studio/${doc.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {doc.title}
                  </Link>
                  {doc.description && (
                    <p className="text-muted-foreground line-clamp-1 text-xs">
                      {doc.description}
                    </p>
                  )}
                </TableCell>

                <TableCell className="hidden md:table-cell">
                  <PageBadge id={doc.id} />
                </TableCell>

                <TableCell className="hidden lg:table-cell">
                  <PdfBadge id={doc.id} />
                </TableCell>

                <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                  {format(new Date(doc.updatedAt), 'MMM d, yyyy · h:mm a')}
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      render={
                        <Link href={`/admin/documents-studio/${doc.id}`} />
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Actions for ${doc.title}`}
                          />
                        }
                      >
                        {busyId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => void handleDownload(doc)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handleDuplicate(doc)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(doc)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <PageNav page={page} totalPages={totalPages} />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” and its stored PDF will be removed. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page navigation                                                            */
/* -------------------------------------------------------------------------- */

function PageNav({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter()
  const [value, setValue] = React.useState(String(page))

  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-muted-foreground text-xs">
        Page {page} of {totalPages}
      </span>
      <Select
        value={value}
        onValueChange={(v) => {
          if (!v) return
          setValue(v)
          router.push(`/admin/documents-studio/list?page=${v}`)
        }}
      >
        <SelectTrigger className="h-7 w-[5.5rem] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <SelectItem key={n} value={String(n)} className="text-xs">
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Metadata badges                                                            */
/* -------------------------------------------------------------------------- */

const detailCache = new Map<string, { setup: PageSetup; pdfUrl: string | null }>()

function useDetail(id: string) {
  const [detail, setDetail] = React.useState(
    () => detailCache.get(id) ?? null
  )

  React.useEffect(() => {
    if (detailCache.has(id)) return

    let cancelled = false
    void (async () => {
      const doc = await getStudioDocument(id)
      if (cancelled || !doc) return
      const setup = readPageSetup(doc.craftJson)
      const next = { setup, pdfUrl: setup.pdfUrl }
      detailCache.set(id, next)
      setDetail(next)
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  return detail
}

function PageBadge({ id }: { id: string }) {
  const detail = useDetail(id)
  if (!detail) return <span className="text-muted-foreground text-xs">—</span>

  const { setup } = detail
  const label =
    setup.pageSize === 'CUSTOM'
      ? 'Custom'
      : setup.pageSize in PAGE_PRESETS
        ? setup.pageSize
        : 'A4'

  return (
    <Badge variant="outline" className="text-[10px] font-normal">
      {label} · {setup.orientation === 'landscape' ? 'L' : 'P'}
    </Badge>
  )
}

function PdfBadge({ id }: { id: string }) {
  const detail = useDetail(id)
  if (!detail?.pdfUrl) {
    return <span className="text-muted-foreground text-xs">Not generated</span>
  }
  return (
    <a
      href={detail.pdfUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
    >
      <Download className="h-3 w-3" />
      Available
    </a>
  )
}
