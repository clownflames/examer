'use client'

import * as React from 'react'
import { Editor, Element, Frame, useEditor } from '@craftjs/core'
import { useRouter } from 'next/navigation'
import { MousePointerClick } from 'lucide-react'
import { toast } from 'sonner'

import {
  DEFAULT_PAGE_SETUP,
  resolvePageSize,
  type CraftJson,
  type PageSetup,
} from '../constants'
import { isSafeCraftJson, readPageSetup } from '../_lib/craft'
import { readVariables, EMPTY_VARIABLES, type DocumentVariable } from '../_lib/variables'
import { Toolbox } from './toolbox'
import { SettingsPanel } from './settings-panel'
import { StudioToolbar } from './studio-toolbar'
import { PdfPreviewDialog } from './pdf-preview-dialog'
import { BulkGenerateDialog } from './bulk-generate-dialog'
import { saveStudioDocument } from '../actions'
import {
  BoxBlock,
  ButtonBlock,
  DividerBlock,
  HeadingBlock,
  ImageBlock,
  ListBlock,
  PageBreakBlock,
  QrBlock,
  SignatureBlock,
  SpacerBlock,
  TableBlock,
  TextBlock,
  TwoColumnBlock,
} from './blocks'

/* -------------------------------------------------------------------------- */
/*  Resolver                                                                   */
/* -------------------------------------------------------------------------- */

const RESOLVER = {
  TextBlock,
  HeadingBlock,
  ListBlock,
  ButtonBlock,
  ImageBlock,
  QrBlock,
  TableBlock,
  DividerBlock,
  SpacerBlock,
  BoxBlock,
  SignatureBlock,
  PageBreakBlock,
  TwoColumnBlock,
}

/* -------------------------------------------------------------------------- */
/*  Editor                                                                     */
/* -------------------------------------------------------------------------- */

export function StudioEditor({
  documentId,
  initialTitle,
  initialJson,
}: {
  documentId?: string | null
  initialTitle?: string
  initialJson?: CraftJson
}) {
  const [zoom, setZoom] = React.useState(70)
  const [preview, setPreview] = React.useState<{
    open: boolean
    blob: Blob | null
  }>({ open: false, blob: null })

  // Only hand a stored document to <Frame> once it passes validation.
  const frameData = React.useMemo(() => {
    if (initialJson && isSafeCraftJson(initialJson)) {
      return JSON.stringify(initialJson)
    }
    return undefined
  }, [initialJson])

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <Editor resolver={RESOLVER} enabled>
        <InnerStudio
          documentId={documentId ?? null}
          initialTitle={initialTitle}
          frameData={frameData}
          zoom={zoom}
          onZoomChange={setZoom}
          onPreview={(blob) => setPreview({ open: true, blob })}
        />
      </Editor>

      <PdfPreviewDialog
        open={preview.open}
        blob={preview.blob}
        onOpenChange={(open) => setPreview((p) => ({ ...p, open }))}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Inner (must live inside <Editor>)                                          */
/* -------------------------------------------------------------------------- */

function InnerStudio({
  documentId,
  initialTitle,
  frameData,
  zoom,
  onZoomChange,
  onPreview,
}: {
  documentId: string | null
  initialTitle?: string
  frameData?: string
  zoom: number
  onZoomChange: (z: number) => void
  onPreview: (blob: Blob) => void
}) {
  const { query } = useEditor()
  const router = useRouter()

  const [title, setTitle] = React.useState(
    initialTitle ?? 'Untitled document'
  )
  const { setup, variables } = useDocumentMeta()

  const [savedId, setSavedId] = React.useState<string | null>(documentId)
  const [generateOpen, setGenerateOpen] = React.useState(false)
  const [snapshot, setSnapshot] = React.useState<CraftJson | null>(null)

  const effectiveId = savedId ?? documentId

  /* ------------------------- save (for new docs) ------------------------- */

  async function persist(): Promise<string | null> {
    try {
      const json = JSON.parse(query.serialize()) as CraftJson
      const res = await saveStudioDocument({
        id: savedId ?? documentId,
        title,
        craftJson: json,
      })

      if (!res.success) {
        toast.error(res.error)
        return null
      }

      setSavedId(res.id)
      if (!savedId && !documentId) {
        router.replace(`/admin/documents-studio/${res.id}`)
      }
      return res.id
    } catch (err) {
      console.error('[studio] save failed:', err)
      toast.error('Could not save the document')
      return null
    }
  }

  /* ------------------------- open the generate dialog ------------------------- */

  async function handleOpenGenerate() {
    // Bulk output has to be attachable to a stored document, so save first.
    let id = effectiveId
    if (!id) {
      const saved = await persist()
      if (!saved) return
      id = saved
    }

    try {
      setSnapshot(JSON.parse(query.serialize()) as CraftJson)
    } catch (err) {
      console.error('[studio] could not read the document:', err)
      toast.error('Could not read the document')
      return
    }

    setGenerateOpen(true)
  }

  /* ------------------------- document meta bridge ------------------------- */

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StudioToolbar
        documentId={documentId}
        savedId={savedId}
        title={title}
        onTitleChange={setTitle}
        onPersist={persist}
        zoom={zoom}
        onZoomChange={onZoomChange}
        onPreview={onPreview}
        onOpenGenerate={handleOpenGenerate}
        variableCount={variables.length}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[13rem_1fr] xl:grid-cols-[14rem_1fr_21rem]">
        {/* ------------------------------ toolbox ------------------------------ */}
        <aside className="bg-background hidden min-h-0 overflow-hidden border-r md:block">
          <Toolbox />
        </aside>

        {/* ------------------------------- canvas ------------------------------- */}
        <main className="bg-zinc-200 min-h-0 overflow-auto dark:bg-zinc-950">
          <PageSurface zoom={zoom} setup={setup} frameData={frameData} />
        </main>

        {/* ---------------------------- settings panel ---------------------------- */}
        <aside className="bg-background hidden min-h-0 overflow-hidden border-l xl:block">
          <SettingsPanel />
        </aside>
      </div>

      {generateOpen && snapshot && effectiveId ? (
        <BulkGenerateDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          json={snapshot}
          title={title}
          variables={variables}
          documentId={effectiveId}
        />
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Bridges                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Reads the page setup and variable definitions off the root node.
 *
 * IMPORTANT: Craft.js's `useCollector` builds a brand new object on **every**
 * store notification (`d(l(e))` with no memoisation), so the wrapper returned
 * by `useEditor()` must never be used as an effect/memo dependency. We
 * destructure the immer-stable `props` reference instead — that only changes
 * when the document actually changes.
 *
 * Derived values are memoised on that stable reference, so no effect (and no
 * setState) is needed to push them upwards.
 */
function useDocumentMeta(): {
  setup: PageSetup
  variables: DocumentVariable[]
} {
  const { rootProps } = useEditor((state) => ({
    rootProps: (state.nodes.ROOT?.data.props ??
      null) as Record<string, unknown> | null,
  }))

  return React.useMemo(() => {
    if (!rootProps) {
      return { setup: DEFAULT_PAGE_SETUP, variables: EMPTY_VARIABLES }
    }

    const json = { ROOT: { type: 'div' as const, isCanvas: true, props: rootProps } }

    return {
      setup: readPageSetup(json),
      variables: readVariables(json),
    }
  }, [rootProps])
}

/* -------------------------------------------------------------------------- */
/*  Page surface                                                               */
/* -------------------------------------------------------------------------- */

function PageSurface({
  zoom,
  setup,
  frameData,
}: {
  zoom: number
  setup: PageSetup
  frameData?: string
}) {
  const size = resolvePageSize(setup)
  const z = zoom / 100
  const minHeight = Math.max(size.height, 320)

  const paperRef = React.useRef<HTMLDivElement>(null)
  const [paperHeight, setPaperHeight] = React.useState(minHeight)

  // Track the real height so the scaled wrapper reserves the right space.
  React.useEffect(() => {
    const el = paperRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (h) setPaperHeight(h)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex min-h-full justify-center px-4 py-6">
      <div
        className="relative shrink-0"
        style={{ width: size.width * z, height: paperHeight * z }}
      >
        <div
          ref={paperRef}
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: size.width, transform: `scale(${z})` }}
        >
          <div
            className="relative overflow-hidden shadow-xl ring-1 ring-black/10 dark:ring-white/10"
            style={{
              width: size.width,
              minHeight,
              backgroundColor: setup.backgroundColor || '#ffffff',
            }}
          >
            <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
              <PageGuides setup={setup} pageHeight={size.height} />
            </div>

            <div
              className="relative"
              style={{
                paddingTop: setup.marginTop,
                paddingRight: setup.marginRight,
                paddingBottom: setup.marginBottom,
                paddingLeft: setup.marginLeft,
              }}
            >
              <Frame data={frameData}>
                <Element is="div" canvas style={{ minHeight: 120 }} />
              </Frame>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page guides                                                                */
/* -------------------------------------------------------------------------- */

function PageGuides({
  setup,
  pageHeight,
}: {
  setup: PageSetup
  pageHeight: number
}) {
  if (pageHeight <= 0) return null

  const boundaries: number[] = []
  if (setup.showGuides) {
    for (let i = 1; i <= 10; i += 1) {
      const top = i * pageHeight
      if (top > 12000) break
      boundaries.push(top)
    }
  }

  return (
    <>
      {boundaries.map((top) => (
        <div
          key={top}
          className="absolute right-0 left-0 border-t border-dashed border-indigo-400/80"
          style={{ top }}
        >
          <span className="absolute top-0.5 right-1 rounded-sm bg-indigo-500 px-1 text-[8px] leading-[12px] font-semibold text-white">
            page {Math.round(top / pageHeight) + 1}
          </span>
        </div>
      ))}

      <div
        className="absolute border border-dashed border-rose-400/70"
        style={{
          top: setup.marginTop,
          right: setup.marginRight,
          bottom: setup.marginBottom,
          left: setup.marginLeft,
        }}
      />

      {setup.gridSize > 4 ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(99,102,241,0.13) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.13) 1px, transparent 1px)',
            backgroundSize: `${setup.gridSize}px ${setup.gridSize}px`,
          }}
        />
      ) : null}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                                */
/* -------------------------------------------------------------------------- */

export function StudioEmptyHint() {
  return (
    <div className="text-muted-foreground pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <MousePointerClick className="h-5 w-5 opacity-40" />
        <p className="text-xs font-medium">Drag a block onto the page</p>
      </div>
    </div>
  )
}
