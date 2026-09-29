'use client'

import * as React from 'react'
import Image from 'next/image'
import { ImagePlus, Loader2, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { getMediaAssets } from '@/app/admin/media/actions'
import type { MediaAssetRow } from '@/app/admin/media/constants'

export function MediaPicker({
  value,
  onChange,
  label = 'Image',
}: {
  value: string | null
  onChange: (url: string) => void
  label?: string
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground text-xs font-medium">
        {label}
      </Label>

      {value ? (
        <div className="flex items-start gap-3 rounded-lg border p-2">
          <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
            <Image
              src={value}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] text-muted-foreground">
              {value.split('/').pop()}
            </p>
            <div className="mt-1.5 flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => setOpen(true)}
              >
                Change
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive h-7 w-7 px-0"
                onClick={() => onChange('')}
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="h-20 w-full gap-2 border-dashed"
        >
          <ImagePlus className="h-4 w-4" />
          Choose image
        </Button>
      )}

      <MediaPickerDialog
        open={open}
        onOpenChange={setOpen}
        onSelect={(url) => {
          onChange(url)
          setOpen(false)
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Picker dialog                                                              */
/* -------------------------------------------------------------------------- */

function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSelect: (url: string) => void
}) {
  const [assets, setAssets] = React.useState<MediaAssetRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [search, setSearch] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)

    getMediaAssets(1, 'all', search)
      .then((res) => {
        if (!cancelled) setAssets(res.data)
      })
      .catch((err) => {
        console.error(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, search])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pick an image</DialogTitle>
          <DialogDescription>
            Choose from your media library.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search images…"
            className="pl-9"
          />
        </div>

        <div className="max-h-[55vh] min-h-[200px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="text-muted-foreground py-16 text-center text-sm">
              No images found. Upload some in{' '}
              <a
                href="/admin/media"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline"
              >
                Media Library
              </a>
              .
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelect(a.url)}
                  className="bg-muted hover:border-primary group relative aspect-square overflow-hidden rounded-md border-2 border-transparent"
                >
                  <Image
                    src={a.url}
                    alt={a.originalName}
                    fill
                    sizes="200px"
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[10px] text-white">
                    {a.originalName}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}