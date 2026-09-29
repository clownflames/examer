'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { Loader2, Minus, Plus, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { PdfDocument } from './pdf-document'
import type { DocumentContent } from '../constants'

/* -------------------------------------------------------------------------- */
/*  Dynamic import — PDFViewer is browser-only                                 */
/* -------------------------------------------------------------------------- */

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/40 flex h-full items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    ),
  }
)

/* -------------------------------------------------------------------------- */
/*  Zoom levels                                                                */
/* -------------------------------------------------------------------------- */

const ZOOM_STEPS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 1.75, 2] as const

type Zoom = (typeof ZOOM_STEPS)[number]

function clampZoom(z: number): Zoom {
  return ZOOM_STEPS.reduce((prev, curr) =>
    Math.abs(curr - z) < Math.abs(prev - z) ? curr : prev
  ) as Zoom
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function PdfPreview({
  content,
  title,
}: {
  content: DocumentContent
  title?: string
}) {
  const [zoom, setZoom] = React.useState<Zoom>(1)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  function zoomIn() {
    const idx = ZOOM_STEPS.indexOf(zoom)
    if (idx < ZOOM_STEPS.length - 1) {
      setZoom(ZOOM_STEPS[idx + 1])
    }
  }

  function zoomOut() {
    const idx = ZOOM_STEPS.indexOf(zoom)
    if (idx > 0) {
      setZoom(ZOOM_STEPS[idx - 1])
    }
  }

  function resetZoom() {
    setZoom(1)
  }

  // Ctrl/Cmd + scroll wheel to zoom
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      if (e.deltaY < 0) zoomIn()
      else zoomOut()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Toolbar */}
      <div className="bg-background/80 flex shrink-0 items-center gap-1.5 border-b px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={zoomOut}
          disabled={zoom === ZOOM_STEPS[0]}
          aria-label="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>

        <Select
          value={String(zoom)}
          onValueChange={(v) => setZoom(clampZoom(Number(v)))}
        >
          <SelectTrigger className="h-7 w-[80px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ZOOM_STEPS.map((z) => (
              <SelectItem key={z} value={String(z)}>
                {Math.round(z * 100)}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={zoomIn}
          disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
          aria-label="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={resetZoom}
          disabled={zoom === 1}
          aria-label="Reset zoom"
          title="Reset zoom"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>

        <span className="text-muted-foreground ml-auto hidden text-[10px] sm:block">
          Ctrl + scroll to zoom
        </span>
      </div>

      {/* Viewer */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900"
      >
        {/*
         * PDFViewer renders its own iframe. When zoom is not 100% we
         * scale the wrapper so the whole iframe scales visually.
         */}
        <div
          className={cn(
            'origin-top-left transition-transform duration-150',
            'h-full w-full'
          )}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
          }}
        >
          <PDFViewer
            showToolbar={false}
            style={{ width: '100%', height: '100%', border: 'none' }}
          >
            <PdfDocument content={content} title={title} />
          </PDFViewer>
        </div>
      </div>
    </div>
  )
}