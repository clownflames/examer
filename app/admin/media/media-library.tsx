'use client'

import * as React from 'react'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Copy,
  Image as ImageIcon,
  Loader2,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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

import { deleteMediaAsset } from './actions'
import { MediaUploadDialog } from './media-upload-dialog'
import type { MediaAssetRow, MediaFilter } from './constants'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                       */
/* -------------------------------------------------------------------------- */

export function MediaLibrary({
  data,
  page,
  totalPages,
  total,
  pageSize,
  currentFilter,
  currentQuery,
}: {
  data: MediaAssetRow[]
  page: number
  totalPages: number
  total: number
  pageSize: number
  currentFilter: MediaFilter
  currentQuery: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = React.useState(currentQuery)
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<MediaAssetRow | null>(
    null
  )
  const [deleting, setDeleting] = React.useState(false)

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

  // debounced search
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

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('URL copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await deleteMediaAsset(deleteTarget.id)
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

  const filters: { value: MediaFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'mine', label: 'Mine' },
    { value: 'admin', label: 'By admins' },
    { value: 'user', label: 'By users' },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-muted/50 inline-flex items-center rounded-lg border p-0.5">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() =>
                  updateParams({
                    filter: f.value === 'all' ? null : f.value,
                    page: '1',
                  })
                }
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  currentFilter === f.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by filename…"
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

        <Button onClick={() => setUploadOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Upload image
        </Button>
      </div>

      {/* Content */}
      {data.length === 0 ? (
        <EmptyState onUpload={() => setUploadOpen(true)} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {data.map((asset) => (
              <MediaCard
                key={asset.id}
                asset={asset}
                onCopy={() => copyUrl(asset.url)}
                onDelete={() => setDeleteTarget(asset)}
              />
            ))}
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

      {/* Upload dialog */}
      <MediaUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => router.refresh()}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              <strong>{deleteTarget?.originalName}</strong> from R2. Documents
              already using it will show a broken image.
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

/* -------------------------------------------------------------------------- */
/*  Media card                                                                 */
/* -------------------------------------------------------------------------- */

function MediaCard({
  asset,
  onCopy,
  onDelete,
}: {
  asset: MediaAssetRow
  onCopy: () => void
  onDelete: () => void
}) {
  return (
    <div className="group bg-card relative overflow-hidden rounded-lg border">
      <div className="bg-muted relative aspect-square">
        <Image
          src={asset.url}
          alt={asset.originalName}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
          className="object-cover"
          unoptimized
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={onCopy}
            aria-label="Copy URL"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="h-8 w-8"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Role badge */}
        <Badge
          variant="secondary"
          className={cn(
            'absolute top-1.5 left-1.5 text-[9px] capitalize',
            asset.uploadedByRole === 'admin'
              ? 'bg-primary/90 text-primary-foreground'
              : ''
          )}
        >
          {asset.uploadedByRole}
        </Badge>
      </div>

      <div className="p-2">
        <p className="truncate text-xs font-medium" title={asset.originalName}>
          {asset.originalName}
        </p>
        <div className="text-muted-foreground mt-0.5 flex items-center justify-between text-[10px]">
          <span>{fmtSize(asset.size)}</span>
          <span>{format(new Date(asset.createdAt), 'MMM d')}</span>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-20 text-center">
      <div className="bg-muted mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
        <ImageIcon className="text-muted-foreground h-6 w-6" />
      </div>
      <p className="mb-1 text-sm font-semibold">No images yet</p>
      <p className="text-muted-foreground max-w-xs text-xs">
        Upload your first image and it will appear here. Reuse it in any
        document.
      </p>
      <Button onClick={onUpload} className="mt-5 gap-2">
        <Upload className="h-4 w-4" />
        Upload image
      </Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page numbers                                                               */
/* -------------------------------------------------------------------------- */

function getPageNumbers(
  current: number,
  total: number
): (number | '…')[] {
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