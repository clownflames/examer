'use client'

import * as React from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { downloadBlob, slugify } from '../_pdf/export-pdf'

export function PdfPreviewDialog({
  open,
  blob,
  onOpenChange,
  filename,
}: {
  open: boolean
  blob: Blob | null
  onOpenChange: (open: boolean) => void
  filename?: string
}) {
  const [url, setUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!blob) return

    const objectUrl = URL.createObjectURL(blob)
    // Set outside the effect body (deferred) so the object URL is only
    // created for a blob we actually have.
    queueMicrotask(() => setUrl(objectUrl))

    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-[min(96vw,1000px)] flex-col gap-3 overflow-hidden sm:max-w-[min(96vw,1000px)]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>PDF preview</span>
            {blob ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  downloadBlob(blob, filename ?? `${slugify('document')}.pdf`)
                  toast.success('PDF downloaded')
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            This is exactly what the exported file will look like.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/40 min-h-0 flex-1 overflow-auto rounded border">
          {url ? (
            <iframe
              src={url}
              title="PDF preview"
              className="h-full w-full border-0"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building preview…
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
