'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useEditor } from '@craftjs/core'
import {
  ArrowLeft,
  Check,
  Eye,
  FileDown,
  Loader2,
  Maximize2,
  Redo2,
  Save,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { PAGE_PRESETS, type CraftJson, type PageSizeKey } from '../constants'
import { readPageSetup } from '../_lib/craft'
import { getStudioPdfUploadUrl, saveStudioPdfMeta } from '../actions'
import {
  downloadBlob,
  generateAndStorePdf,
  renderPdfBlob,
  type PdfStatus,
} from '../_pdf/export-pdf'

const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 200]

const PRESET_KEYS = Object.keys(PAGE_PRESETS) as (keyof typeof PAGE_PRESETS)[]

export function StudioToolbar({
  documentId,
  savedId,
  title,
  onTitleChange,
  onPersist,
  zoom,
  onZoomChange,
  onPreview,
  onOpenGenerate,
  variableCount,
}: {
  documentId?: string | null
  savedId: string | null
  title: string
  onTitleChange: (value: string) => void
  onPersist: () => Promise<string | null>
  zoom: number
  onZoomChange: (z: number) => void
  onPreview: (blob: Blob) => void
  onOpenGenerate: () => void
  variableCount: number
}) {
  const router = useRouter()
  const { query, actions } = useEditor()

  const [saving, setSaving] = React.useState(false)
  const [pdfStatus, setPdfStatus] = React.useState<PdfStatus>('idle')
  const [saved, setSaved] = React.useState(false)

  const { pageSize } = useEditor((state) => {
    const root = state.nodes.ROOT
    if (!root) return { pageSize: 'A4' as PageSizeKey }
    return {
      pageSize: readPageSetup({
        ROOT: { type: 'div', isCanvas: true, props: root.data.props },
      }).pageSize,
    }
  })

  const busy = pdfStatus !== 'idle' || saving

  /* ------------------------------------------------------------------ */
  /*  History                                                            */
  /* ------------------------------------------------------------------ */

  function undo() {
    try {
      actions.history.undo()
    } catch {
      /* nothing left to undo */
    }
  }

  function redo() {
    try {
      actions.history.redo()
    } catch {
      /* nothing left to redo */
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Save                                                               */
  /* ------------------------------------------------------------------ */

  const handleSave = React.useCallback(
    async (opts?: { silent?: boolean }): Promise<string | null> => {
      setSaving(true)
      try {
        const id = await onPersist()
        if (!id) return null

        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        if (!opts?.silent) toast.success('Document saved')
        return id
      } finally {
        setSaving(false)
      }
    },
    [onPersist]
  )

  const handleSaveRef = React.useRef(handleSave)
  React.useEffect(() => {
    handleSaveRef.current = handleSave
  }, [handleSave])

  /* ------------------------------------------------------------------ */
  /*  PDF                                                                */
  /* ------------------------------------------------------------------ */

  const handlePreview = React.useCallback(async () => {
    setPdfStatus('building')
    try {
      const json = JSON.parse(query.serialize()) as CraftJson
      onPreview(await renderPdfBlob(json, title))
    } catch (err) {
      console.error('[studio] preview failed:', err)
      toast.error('Could not build the preview')
    } finally {
      setPdfStatus('idle')
    }
  }, [onPreview, query, title])

  const handleGenerate = React.useCallback(async () => {
    // A brand new document must be persisted before we can attach a PDF to it.
    let id = savedId ?? documentId ?? null
    if (!id) {
      const saved = await handleSaveRef.current({ silent: true })
      if (!saved) {
        setPdfStatus('idle')
        toast.error('Save the document first')
        return
      }
      id = saved
    }

    const json = JSON.parse(query.serialize()) as CraftJson

    const result = await generateAndStorePdf({
      json,
      title,
      documentId: id,
      getUploadUrl: getStudioPdfUploadUrl,
      onStatus: setPdfStatus,
    })

    setPdfStatus('idle')

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    downloadBlob(result.blob, result.filename)

    if (result.stored && result.publicUrl && result.key) {
      const meta = await saveStudioPdfMeta(id, {
        url: result.publicUrl,
        key: result.key,
        size: result.blob.size,
      })

      if (meta.success) {
        // Reflect the new pointer in the editor so the Page tab updates.
        actions.setProp('ROOT', (props: Record<string, unknown>) => {
          props.pdfUrl = result.publicUrl
          props.pdfKey = result.key
          props.pdfGeneratedAt = new Date().toISOString()
        })
        toast.success('PDF generated, downloaded and saved')
      } else {
        toast.success('PDF generated and downloaded (storage not updated)')
      }
    } else {
      toast.success('PDF generated and downloaded')
    }
  }, [actions, documentId, query, savedId, title])

  /* ------------------------------------------------------------------ */
  /*  Zoom                                                               */
  /* ------------------------------------------------------------------ */

  function zoomIn() {
    const next =
      ZOOM_STEPS.find((z) => z > zoom) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
    onZoomChange(next)
  }

  function zoomOut() {
    const next =
      [...ZOOM_STEPS].reverse().find((z) => z < zoom) ?? ZOOM_STEPS[0]
    onZoomChange(next)
  }

  function setPageSize(value: PageSizeKey) {
    actions.setProp('ROOT', (props: Record<string, unknown>) => {
      props.pageSize = value
    })
  }

  /* ------------------------------------------------------------------ */
  /*  Keyboard shortcuts                                                 */
  /* ------------------------------------------------------------------ */

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
      }

      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSaveRef.current()
        return
      }

      if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        if (!busy) void handlePreview()
        return
      }

      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        if (!busy) onOpenGenerate()
        return
      }

      if (mod && e.key === '0') {
        e.preventDefault()
        onZoomChange(100)
        return
      }

      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        zoomIn()
        return
      }

      if (mod && e.key === '-') {
        e.preventDefault()
        zoomOut()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <header className="bg-background flex h-14 shrink-0 items-center gap-2 border-b px-2 md:px-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => router.push('/admin/documents-studio/list')}
        aria-label="Back to documents"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Document title"
        className="h-8 max-w-[14rem] flex-1 border-transparent bg-transparent text-sm font-semibold shadow-none focus-visible:border-input md:max-w-xs"
      />

      {/* ---------------- history + zoom ---------------- */}
      <div className="bg-muted/50 hidden items-center rounded-lg border p-0.5 lg:flex">
        <IconAction label="Undo (Ctrl+Z)" onClick={undo} disabled={busy}>
          <Undo2 className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={busy}>
          <Redo2 className="h-3.5 w-3.5" />
        </IconAction>

        <span className="mx-0.5 h-5 w-px bg-border" />

        <IconAction label="Zoom out (Ctrl+-)" onClick={zoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </IconAction>
        <button
          type="button"
          onClick={() => onZoomChange(100)}
          title="Reset zoom to 100% (Ctrl+0)"
          className="hover:bg-muted min-w-[3rem] rounded px-1 py-1 text-[11px] font-medium tabular-nums"
        >
          {zoom}%
        </button>
        <IconAction label="Zoom in (Ctrl++)" onClick={zoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction label="Fit to screen" onClick={() => onZoomChange(70)}>
          <Maximize2 className="h-3.5 w-3.5" />
        </IconAction>
      </div>

      {/* ---------------- page size ---------------- */}
      <Select
        value={pageSize}
        onValueChange={(v) => setPageSize(v as PageSizeKey)}
      >
        <SelectTrigger className="hidden h-8 w-[9.5rem] text-xs xl:flex">
          <SelectValue placeholder="Page size" />
        </SelectTrigger>
        <SelectContent>
          {PRESET_KEYS.map((key) => (
            <SelectItem key={key} value={key} className="text-xs">
              {PAGE_PRESETS[key].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ---------------- actions ---------------- */}
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving || pdfStatus !== 'idle'}
          className="gap-1.5"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Save</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handlePreview()}
          disabled={busy}
          title="Preview the PDF (Ctrl+P)"
          className="gap-1.5"
        >
          {pdfStatus === 'building' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          <span className="hidden md:inline">Preview</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenGenerate}
          disabled={busy}
          title="Fill in values, or build one PDF per spreadsheet row (Ctrl+G)"
          className="gap-1.5"
        >
          <Wand2 className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Fill / Bulk</span>
          {variableCount > 0 ? (
            <span className="bg-primary text-primary-foreground rounded px-1 text-[9px] tabular-nums">
              {variableCount}
            </span>
          ) : null}
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={() => void handleGenerate()}
          disabled={busy}
          title="Generate the PDF, save a copy to storage and download it"
          className="gap-1.5"
        >
          {pdfStatus !== 'idle' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {pdfStatus === 'uploading' ? 'Saving…' : 'Generate PDF'}
          </span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/*  Small icon action                                                          */
/* -------------------------------------------------------------------------- */

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="h-7 w-7"
    >
      {children}
    </Button>
  )
}
