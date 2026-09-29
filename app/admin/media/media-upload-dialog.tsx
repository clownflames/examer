'use client'

import * as React from 'react'
import Image from 'next/image'
import { AlertCircle, Check, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { getMediaUploadUrl, saveMediaAsset } from './actions'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

type Pending = {
  file: File
  previewUrl: string
  width: number | null
  height: number | null
}

type Progress = 'idle' | 'uploading' | 'done' | 'error'

/* -------------------------------------------------------------------------- */
/*  Dialog                                                                     */
/* -------------------------------------------------------------------------- */

export function MediaUploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onUploaded?: () => void
}) {
  const [pending, setPending] = React.useState<Pending[]>([])
  const [progress, setProgress] = React.useState<Progress>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const [dragOver, setDragOver] = React.useState(false)

  const inputRef = React.useRef<HTMLInputElement | null>(null)

  // cleanup preview URLs
  React.useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // reset when dialog closes
  React.useEffect(() => {
    if (!open) {
      setPending([])
      setProgress('idle')
      setError(null)
      setDragOver(false)
    }
  }, [open])

  async function fileToPreview(file: File): Promise<Pending | null> {
    if (!ACCEPTED.includes(file.type)) {
      toast.error(`${file.name} is not a supported image type.`)
      return null
    }
    if (file.size > MAX_SIZE) {
      toast.error(`${file.name} is larger than 10 MB.`)
      return null
    }

    const previewUrl = URL.createObjectURL(file)

    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new window.Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve({ w: 0, h: 0 })
      img.src = previewUrl
    })

    return {
      file,
      previewUrl,
      width: dims.w || null,
      height: dims.h || null,
    }
  }

  async function addFiles(files: FileList | File[]) {
    setError(null)
    const list = Array.from(files)
    const results: Pending[] = []
    for (const f of list) {
      const p = await fileToPreview(f)
      if (p) results.push(p)
    }
    setPending((prev) => [...prev, ...results])
  }

  function removeAt(index: number) {
    setPending((prev) => {
      const next = [...prev]
      const [removed] = next.splice(index, 1)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return next
    })
  }

  async function handleUpload() {
    if (pending.length === 0) return
    setProgress('uploading')
    setError(null)

    let successCount = 0

    for (const item of pending) {
      try {
        // 1) presign
        const presign = await getMediaUploadUrl({
          fileName: item.file.name,
          contentType: item.file.type,
        })

        if (!presign.success) {
          throw new Error(presign.error)
        }

        // 2) PUT to R2
        const putRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          body: item.file,
          headers: { 'Content-Type': item.file.type },
        })

        if (!putRes.ok) {
          throw new Error(`Upload failed (${putRes.status})`)
        }

        // 3) save metadata
        const save = await saveMediaAsset({
          fileName: presign.key.split('/').pop() ?? item.file.name,
          originalName: item.file.name,
          mimeType: item.file.type,
          size: item.file.size,
          url: presign.publicUrl,
          key: presign.key,
          width: item.width,
          height: item.height,
        })

        if (!save.success) {
          throw new Error(save.error)
        }

        successCount += 1
      } catch (err) {
        console.error('[media upload]', err)
        const msg =
          err instanceof Error ? err.message : 'Unknown upload error'
        setError(`${item.file.name}: ${msg}`)
        setProgress('error')
        return
      }
    }

    setProgress('done')
    toast.success(
      successCount === 1
        ? 'Image uploaded'
        : `${successCount} images uploaded`
    )
    onUploaded?.()

    // Reset & close after a beat
    setTimeout(() => {
      onOpenChange(false)
    }, 500)
  }

  const isUploading = progress === 'uploading'

  return (
    <Dialog open={open} onOpenChange={(o) => !isUploading && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload images</DialogTitle>
          <DialogDescription>
            JPEG, PNG, WebP or GIF. Max 10 MB per file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Drop zone */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              if (e.dataTransfer.files) void addFiles(e.dataTransfer.files)
            }}
            disabled={isUploading}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40',
              isUploading && 'pointer-events-none opacity-60'
            )}
          >
            <Upload className="text-muted-foreground mb-2 h-6 w-6" />
            <p className="text-sm font-medium">
              Drop images here or click to browse
            </p>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Up to 10 MB each
            </p>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files)
              e.target.value = ''
            }}
          />

          {/* Preview grid */}
          {pending.length > 0 && (
            <div className="max-h-[240px] overflow-y-auto rounded-lg border p-2">
              <div className="grid grid-cols-3 gap-2">
                {pending.map((p, i) => (
                  <div
                    key={i}
                    className="group bg-muted relative aspect-square overflow-hidden rounded-md"
                  >
                    <Image
                      src={p.previewUrl}
                      alt={p.file.name}
                      fill
                      sizes="120px"
                      className="object-cover"
                      unoptimized
                    />
                    {!isUploading && (
                      <button
                        type="button"
                        onClick={() => removeAt(i)}
                        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={pending.length === 0 || isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : progress === 'done' ? (
              <>
                <Check className="h-4 w-4" />
                Done
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload {pending.length > 0 && `(${pending.length})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}