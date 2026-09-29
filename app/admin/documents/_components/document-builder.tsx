'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Braces,
  Download,
  LayoutGrid,
  Loader2,
  Palette,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

import { BlockList } from './block-list'
import { BlockEditor } from './block-editor'
import { ThemeControls } from './theme-controls'
import { PdfPreview } from './pdf-preview'
import { VariablesPanel } from './variables-panel'
import { GenerateDialog } from './generate-dialog'
import {
  EMPTY_CONTENT,
  type DocumentBlock,
  type DocumentContent,
  type DocumentTheme,
  type DocumentVariable,
} from '../constants'
import { saveDocument, getPdfUploadUrl, updatePdfUrl } from '../actions'
import { useUndoRedo } from '../_hooks/use-undo-redo'
import { useKeyboardShortcuts } from '../_hooks/use-keyboard-shortcuts'

type Tab = 'blocks' | 'theme' | 'vars'

export function DocumentBuilder({
  mode,
  documentId,
  initialTitle,
  initialDescription,
  initialContent,
}: {
  mode: 'create' | 'edit'
  documentId?: string
  initialTitle?: string
  initialDescription?: string | null
  initialContent?: DocumentContent
}) {
  const router = useRouter()

  const [title, setTitle] = React.useState(initialTitle ?? 'Untitled document')
  const [description, setDescription] = React.useState(
    initialDescription ?? ''
  )

  const {
    state: content,
    set: setContent,
    commit: commitContent,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetContent,
  } = useUndoRedo<DocumentContent>(initialContent ?? EMPTY_CONTENT)

  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(
    initialContent?.blocks[0]?.id ?? null
  )
  const [activeTab, setActiveTab] = React.useState<Tab>('blocks')
  const [saving, setSaving] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [generateOpen, setGenerateOpen] = React.useState(false)

  const selectedBlock = React.useMemo(
    () => content.blocks.find((b) => b.id === selectedBlockId) ?? null,
    [content.blocks, selectedBlockId]
  )

  /* -------------------- Block ops -------------------- */

  const updateBlockDiscrete = React.useCallback(
    (next: DocumentBlock) => {
      commitContent((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === next.id ? next : b)),
      }))
    },
    [commitContent]
  )

  const deleteSelectedBlock = React.useCallback(() => {
    if (!selectedBlockId) return
    commitContent((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== selectedBlockId),
    }))
    setSelectedBlockId(null)
  }, [commitContent, selectedBlockId])

  const duplicateSelectedBlock = React.useCallback(() => {
    if (!selectedBlockId) return
    commitContent((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === selectedBlockId)
      if (idx < 0) return prev
      const copy = { ...prev.blocks[idx] }
      copy.id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)
      const next = [...prev.blocks]
      next.splice(idx + 1, 0, copy)
      queueMicrotask(() => setSelectedBlockId(copy.id))
      return { ...prev, blocks: next }
    })
  }, [commitContent, selectedBlockId])

  const setBlocks = React.useCallback(
    (blocks: DocumentBlock[]) => {
      commitContent((prev) => ({ ...prev, blocks }))
    },
    [commitContent]
  )

  const setThemeDiscrete = React.useCallback(
    (theme: DocumentTheme) => {
      commitContent((prev) => ({ ...prev, theme }))
    },
    [commitContent]
  )

  const setVariables = React.useCallback(
    (variables: DocumentVariable[]) => {
      commitContent((prev) => ({ ...prev, variables }))
    },
    [commitContent]
  )

  /* -------------------- Save -------------------- */

  const handleSave = React.useCallback(async (): Promise<string | null> => {
    setSaving(true)
    const res = await saveDocument({
      id: documentId ?? null,
      title,
      description,
      content,
    })
    setSaving(false)

    if (!res.success) {
      toast.error(res.error)
      return null
    }
    toast.success('Document saved')
    resetContent(content)
    return res.id
  }, [documentId, title, description, content, resetContent])

  const handleSaveRef = React.useRef(handleSave)
  React.useEffect(() => {
    handleSaveRef.current = handleSave
  }, [handleSave])

  /* -------------------- Shortcuts -------------------- */

  useKeyboardShortcuts({
    onSave: () => {
      void handleSaveRef.current()
    },
    onUndo: undo,
    onRedo: redo,
    onDelete: deleteSelectedBlock,
    onDuplicate: duplicateSelectedBlock,
    onEscape: () => setSelectedBlockId(null),
  })

  /* -------------------- Generate PDF -------------------- */

  const handleDownloadAndUpload = React.useCallback(
    async (variableValues: Record<string, string>) => {
      setGenerating(true)
      try {
        const savedId = documentId ?? (await handleSave())
        if (!savedId) {
          setGenerating(false)
          return
        }

        const { pdf } = await import('@react-pdf/renderer')
        const { PdfDocument: PdfDoc } = await import('./pdf-document')

        const blob = await pdf(
          <PdfDoc
            content={content}
            title={title}
            variableValues={variableValues}
          />
        ).toBlob()

        const localUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = localUrl
        link.download = `${slugify(title)}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(localUrl)

        const presign = await getPdfUploadUrl(savedId)
        if (!presign.success) throw new Error(presign.error)

        const putRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'application/pdf' },
        })
        if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`)

        await updatePdfUrl(savedId, presign.publicUrl, presign.key)

        toast.success('PDF generated and saved to R2')
        setGenerateOpen(false)

        if (mode === 'create') {
          router.replace(`/admin/documents/${savedId}/edit`)
        } else {
          router.refresh()
        }
      } catch (err) {
        console.error(err)
        toast.error(
          err instanceof Error ? err.message : 'Could not generate PDF'
        )
      } finally {
        setGenerating(false)
      }
    },
    [content, documentId, handleSave, mode, router, title]
  )

  function handleGenerateClick() {
    const vars = content.variables ?? []
    if (vars.length === 0) {
      void handleDownloadAndUpload({})
    } else {
      setGenerateOpen(true)
    }
  }

  /* -------------------- Render -------------------- */

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-2.5 md:gap-3 md:px-4 md:py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/documents')}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="max-w-xs border-transparent bg-transparent text-sm font-semibold shadow-none focus-visible:border-input"
            placeholder="Document title"
          />

          <div className="ml-auto flex items-center gap-1.5">
            <div className="bg-muted/50 flex items-center rounded-lg border p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={undo}
                disabled={!canUndo}
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving || generating}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Save</span>
            </Button>

            <Button
              size="sm"
              onClick={handleGenerateClick}
              disabled={saving || generating}
              className="gap-2"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Generate PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 p-3 md:p-4 lg:grid-cols-[1fr_400px]">
        {/* Left — Preview */}
        <div className="bg-muted/30 flex min-h-[500px] flex-col overflow-hidden rounded-xl border lg:min-h-[600px]">
          <div className="bg-background/80 flex items-center justify-between border-b px-4 py-2 text-xs">
            <span className="text-muted-foreground">
              Live preview · {content.blocks.length} block
              {content.blocks.length === 1 ? '' : 's'}
            </span>
            <span className="text-muted-foreground">
              {content.theme.pageSize} · {content.theme.orientation}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <PdfPreview content={content} title={title} />
          </div>
        </div>

        {/* Right — Controls */}
        <aside className="flex min-h-[500px] flex-col overflow-hidden rounded-xl border lg:min-h-[600px]">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as Tab)}
            className="flex h-full flex-col"
          >
            <TabsList className="m-2 grid grid-cols-3">
              <TabsTrigger value="blocks" className="gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" />
                Blocks
              </TabsTrigger>
              <TabsTrigger value="theme" className="gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                Theme
              </TabsTrigger>
              <TabsTrigger value="vars" className="gap-1.5">
                <Braces className="h-3.5 w-3.5" />
                Vars
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="blocks"
              className="mt-0 flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <div className="flex-1 overflow-hidden">
                <BlockList
                  blocks={content.blocks}
                  selectedId={selectedBlockId}
                  onSelect={setSelectedBlockId}
                  onChange={setBlocks}
                />
              </div>

              {selectedBlock && (
                <>
                  <Separator />
                  <div className="max-h-[45%] overflow-y-auto p-4">
                    <BlockEditor
                      block={selectedBlock}
                      onChange={updateBlockDiscrete}
                      onDelete={deleteSelectedBlock}
                    />
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent
              value="theme"
              className="mt-0 flex-1 overflow-y-auto p-4 data-[state=inactive]:hidden"
            >
              <ThemeControls
                theme={content.theme}
                onChange={setThemeDiscrete}
              />
            </TabsContent>

            <TabsContent
              value="vars"
              className="mt-0 flex-1 overflow-y-auto p-4 data-[state=inactive]:hidden"
            >
              <VariablesPanel content={content} onChange={setVariables} />
            </TabsContent>
          </Tabs>

          <Separator />
          <div className="p-3">
            <Label className="text-muted-foreground text-xs font-medium">
              Description (optional)
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
              placeholder="What is this document for?"
            />
          </div>
        </aside>
      </div>

      {/* Generate dialog */}
      <GenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        variables={content.variables ?? []}
        submitting={generating}
        onSubmit={(values) => void handleDownloadAndUpload(values)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Utils                                                                      */
/* -------------------------------------------------------------------------- */

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'document'
  )
}