'use client'

import * as React from 'react'
import {
  AlertCircle,
  ClipboardPaste,
  FileArchive,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { CraftJson } from '../constants'
import {
  buildFileName,
  matchHeaders,
  parseDelimited,
  rowToValues,
  variableDefaults,
  type DocumentVariable,
} from '../_lib/variables'
import {
  ACCEPTED_FILE_TYPES,
  buildSampleSheet,
  isSpreadsheetFile,
  readSpreadsheetFile,
  sampleFileName,
} from '../_lib/sheet'
import {
  archiveName,
  downloadBlob,
  renderBulkZips,
  renderPdfBlob,
  slugify,
  uploadBatch,
  type BulkProgress,
  type UploadedPdf,
} from '../_pdf/export-pdf'
import {
  getStudioPdfUploadUrl,
  saveStudioBatch,
  saveStudioPdfMeta,
} from '../actions'

const SAMPLE = `name,email,course,issued_on
Aarav Sharma,aarav@example.com,B.Tech,01/04/2026
Diya Patel,diya@example.com,M.Tech,01/04/2026
Rohan Mehta,rohan@example.com,BBA,01/04/2026`

/** Soft cap — generation is sequential, so warn before a huge run. */
const LARGE_RUN = 200

type Mode = 'single' | 'bulk'

export function BulkGenerateDialog({
  open,
  onOpenChange,
  json,
  title,
  variables,
  documentId,
  onGenerated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  json: CraftJson
  title: string
  variables: DocumentVariable[]
  documentId: string
  onGenerated?: (files: UploadedPdf[]) => void
}) {
  const [mode, setMode] = React.useState<Mode>('bulk')
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [paste, setPaste] = React.useState('')
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [manualMapping, setManualMapping] = React.useState<
    Record<number, string> | null
  >(null)
  const [nameTemplate, setNameTemplate] = React.useState('')
  const [store, setStore] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState<BulkProgress | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const defaults = React.useMemo(
    () => variableDefaults(variables),
    [variables]
  )

  React.useEffect(() => {
    if (!open) return
    // Deferred so the setState does not run inside the effect body.
    queueMicrotask(() => {
      setValues(defaults)
      setProgress(null)
    })
  }, [open, defaults])

  /* ------------------------------ data ------------------------------ */

  const table = React.useMemo(() => parseDelimited(paste), [paste])
  const autoMapping = React.useMemo(
    () => matchHeaders(table.headers, variables),
    [table.headers, variables]
  )

  // Any edit to the pasted data invalidates a manual mapping.
  React.useEffect(() => {
    queueMicrotask(() => setManualMapping(null))
  }, [paste])

  const mapping = manualMapping ?? autoMapping
  const records = React.useMemo(
    () => table.rows.map((row) => rowToValues(row, mapping)),
    [table.rows, mapping]
  )

  /**
   * Zip entries must have unique names, so collisions get numbered. Surfacing
   * this up front stops the "why is everything called the same?" confusion.
   */
  const namePreview = React.useMemo(() => {
    if (records.length === 0) return { names: [] as string[], unique: 0 }

    const names: string[] = []
    const used = new Set<string>()

    for (let i = 0; i < records.length; i += 1) {
      const values = { ...defaults, ...records[i] }
      const base = buildFileName(nameTemplate || title, values, i, title)
      const seen = used.has(base)
      used.add(base)
      names.push(seen ? `${base.replace(/\.pdf$/i, '')}-${used.size}.pdf` : base)
    }

    return { names, unique: used.size }
  }, [records, defaults, nameTemplate, title])

  const collisions = records.length - namePreview.unique

  const usedKeys = React.useMemo(
    () => variables.filter((v) => JSON.stringify(json).includes(`{{${v.key}}}`)),
    [variables, json]
  )

  const canRun = mode === 'single' || records.length > 0

  /* ------------------------------ helpers ------------------------------ */

  function handleClear() {
    setPaste('')
    setFileName(null)
    setManualMapping(null)
  }

  /**
   * Hand the user a ready-to-fill template with one column per variable, so the
   * only thing left to do is type the values.
   */
  function handleDownloadSample() {
    if (variables.length === 0) {
      toast.error('Define some variables first (Vars tab)')
      return
    }

    const sheet = buildSampleSheet(variables)
    if (!sheet) {
      toast.error('Could not build the template')
      return
    }

    downloadBlob(
      new Blob([sheet], { type: 'text/csv;charset=utf-8' }),
      sampleFileName(title)
    )
    toast.success(
      `Template with ${variables.length} column${variables.length === 1 ? '' : 's'} downloaded`
    )
  }

  async function handleFile(file: File) {
    if (!isSpreadsheetFile(file)) {
      toast.error('Use a .csv, .tsv, .txt or .xlsx file')
      return
    }

    const result = await readSpreadsheetFile(file)
    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setFileName(result.name)
    setPaste(result.text)
    setManualMapping(null)

    toast.success(
      `${result.name} loaded · ${result.rowCount} row${result.rowCount === 1 ? '' : 's'}`
    )
  }

  /* ------------------------------------------------------------------ */
  /*  Single PDF                                                         */
  /* ------------------------------------------------------------------ */

  async function runSingle() {
    setBusy(true)
    setProgress({
      done: 0,
      total: 1,
      current: 'document.pdf',
      phase: 'building',
    })

    try {
      const merged = { ...defaults, ...values }
      const blob = await renderPdfBlob(json, title, { values: merged })
      const name = `${slugify(title)}.pdf`

      downloadBlob(blob, name)

      if (store) {
        const presign = await getStudioPdfUploadUrl(documentId, name)
        if (presign.success) {
          const response = await fetch(presign.uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: { 'Content-Type': 'application/pdf' },
          })

          if (response.ok) {
            const saved = await saveStudioPdfMeta(documentId, {
              url: presign.publicUrl,
              key: presign.key,
              size: blob.size,
            })
            toast.success(
              saved.success
                ? 'PDF generated, downloaded and saved'
                : 'PDF generated and downloaded'
            )
          } else {
            toast.success('PDF generated and downloaded')
          }
        } else {
          toast.success('PDF generated and downloaded')
        }
      } else {
        toast.success('PDF downloaded')
      }
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : 'Could not build the PDF'
      )
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Bulk                                                               */
  /* ------------------------------------------------------------------ */

  async function runBulk() {
    setBusy(true)

    try {
      const { files, zip, deduped } = await renderBulkZips({
        json,
        title,
        records,
        nameTemplate,
        defaults,
        onProgress: setProgress,
      })

      downloadBlob(zip, archiveName(title, files.length))

      if (store) {
        setProgress({
          done: 0,
          total: files.length,
          current: '',
          phase: 'uploading',
        })

        const uploaded = await uploadBatch({
          documentId,
          files,
          getUploadUrl: getStudioPdfUploadUrl,
          onProgress: setProgress,
        })

        if (uploaded.length > 0) {
          const saved = await saveStudioBatch(documentId, uploaded)
          onGenerated?.(uploaded)
          toast.success(
            saved.success
              ? `${files.length} PDFs zipped, downloaded and saved`
              : `${files.length} PDFs zipped and downloaded`
          )
        } else {
          toast.error('Zip downloaded, but nothing could be saved to storage')
        }
      } else {
        toast.success(`${files.length} PDFs zipped and downloaded`)
      }

      if (deduped > 0) {
        toast.warning(
          `${formatCount(deduped, 'file name')} matched, so ${deduped === 1 ? 'it was' : 'they were'} numbered — set a name pattern for meaningful names.`
        )
      }
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : 'Bulk generation failed'
      )
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  function handleRun() {
    if (mode === 'single') void runSingle()
    else void runBulk()
  }

  /* ------------------------------ render ------------------------------ */

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-3 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Generate PDF
          </DialogTitle>
          <DialogDescription>
            {usedKeys.length > 0 ? (
              <>
                Placeholders in this document:{' '}
                {usedKeys.map((v) => (
                  <code key={v.key} className="font-mono text-[11px]">
                    {`{{${v.key}}}`}{' '}
                  </code>
                ))}
              </>
            ) : (
              'No variables in this document — it will be generated as-is.'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ------------------------- mode ------------------------- */}
        <div className="bg-muted/60 flex shrink-0 rounded-lg border p-0.5">
          {(
            [
              { key: 'single', label: 'Single PDF' },
              { key: 'bulk', label: 'Bulk from spreadsheet' },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMode(option.key)}
              disabled={busy}
              className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === option.key
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {mode === 'single' ? (
            <div className="flex flex-col gap-3">
              {variables.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No variables defined.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {variables.map((variable) => (
                    <div
                      key={variable.key}
                      className="flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">
                          {variable.label}
                        </span>
                        <code className="text-muted-foreground font-mono text-[10px]">
                          {`{{${variable.key}}}`}
                        </code>
                      </div>
                      <Input
                        type={
                          variable.type === 'date'
                            ? 'date'
                            : variable.type === 'number'
                              ? 'number'
                              : 'text'
                        }
                        value={values[variable.key] ?? ''}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [variable.key]: e.target.value,
                          }))
                        }
                        placeholder={
                          variable.type === 'image'
                            ? 'https://… (image URL)'
                            : (variable.defaultValue ?? variable.label)
                        }
                        className="h-8 text-xs"
                      />
                      {variable.description ? (
                        <p className="text-muted-foreground text-[10px]">
                          {variable.description}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <StoreToggle store={store} setStore={setStore} busy={busy} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* ---------------------- source ---------------------- */}
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium">
                    Your data (first row = column names)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 px-2 text-[10px]"
                      disabled={busy}
                      onClick={handleDownloadSample}
                      title={
                        variables.length === 0
                          ? 'Define variables first in the Vars tab'
                          : `CSV with one column per variable: ${variables
                              .map((v) => v.key)
                              .join(', ')}`
                      }
                    >
                      <FileDown className="h-3 w-3" />
                      Download sample
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 px-2 text-[10px]"
                      disabled={busy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3 w-3" />
                      Upload file
                    </Button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleFile(file)
                    // Allow re-picking the same file.
                    e.target.value = ''
                  }}
                />

                {/* ---------------------- drop zone ---------------------- */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    const file = e.dataTransfer.files?.[0]
                    if (file) void handleFile(file)
                  }}
                  className={`rounded-md border border-dashed transition-colors ${
                    dragging
                      ? 'border-primary bg-primary/5'
                      : 'border-input'
                  }`}
                >
                  <Textarea
                    value={paste}
                    onChange={(e) => {
                      setFileName(null)
                      setPaste(e.target.value)
                    }}
                    rows={6}
                    spellCheck={false}
                    placeholder={SAMPLE}
                    className="resize-y border-0 font-mono text-[11px] focus-visible:ring-0"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {fileName ? (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <FileSpreadsheet className="h-3 w-3" />
                      {fileName}
                    </Badge>
                  ) : null}

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-[10px]"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        setFileName(null)
                        setPaste(await navigator.clipboard.readText())
                      } catch {
                        toast.error('Clipboard read was blocked')
                      }
                    }}
                  >
                    <ClipboardPaste className="h-3 w-3" />
                    Paste
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px]"
                    disabled={busy}
                    onClick={() => setPaste(SAMPLE)}
                  >
                    Use sample
                  </Button>

                  {paste.trim() ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground h-6 gap-1 px-2 text-[10px]"
                      disabled={busy}
                      onClick={handleClear}
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </Button>
                  ) : null}
                </div>

                <p className="text-muted-foreground text-[10px]">
                  Drop a file here, upload one, or paste straight from a
                  spreadsheet. Accepts .csv, .tsv, .txt and .xlsx.
                </p>
              </div>

              {/* ---------------------- mapping ---------------------- */}
              {table.headers.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium">Column mapping</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {table.headers.map((header, index) => (
                      <div
                        key={`${header}-${index}`}
                        className="flex items-center gap-2 rounded border px-2 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                          {header}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          →
                        </span>
                        <Select
                          value={mapping[index] ?? 'ignore'}
                          onValueChange={(next) => {
                            if (!next) return
                            setManualMapping((prev) => {
                              const merged = { ...(prev ?? autoMapping) }
                              if (next === 'ignore') delete merged[index]
                              else merged[index] = next
                              return merged
                            })
                          }}
                        >
                          <SelectTrigger className="h-7 w-[9.5rem] text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore" className="text-[11px]">
                              — ignore —
                            </SelectItem>
                            {variables.map((v) => (
                              <SelectItem
                                key={v.key}
                                value={v.key}
                                className="text-[11px]"
                              >
                                {`{{${v.key}}}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---------------------- summary ---------------------- */}
              {records.length > 0 && (
                <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
                  <Badge>{records.length} PDFs</Badge>
                  <span className="text-muted-foreground">
                    from {table.headers.length} column
                    {table.headers.length === 1 ? '' : 's'}
                  </span>
                  {collisions > 0 ? (
                    <span
                      className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
                      title="Identical file names are numbered automatically so every record is kept."
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      {formatCount(collisions, 'name')} clash
                      {collisions === 1 ? 'es' : ''} — will be numbered
                    </span>
                  ) : null}
                  {records.length > LARGE_RUN ? (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                      large run — this can take a while
                    </span>
                  ) : null}
                  <div className="ml-auto">
                    <StoreToggle
                      store={store}
                      setStore={setStore}
                      busy={busy}
                      compact
                    />
                  </div>
                </div>
              )}

              {/* ---------------------- filename ---------------------- */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">
                  File name pattern (optional)
                </span>
                <Input
                  value={nameTemplate}
                  onChange={(e) => setNameTemplate(e.target.value)}
                  placeholder={
                    variables[0]
                      ? `{{${variables[0].key}}}${variables[1] ? ` - {{${variables[1].key}}}` : ''}`
                      : title
                  }
                  className="h-8 font-mono text-[11px]"
                />
                {namePreview.names.length > 0 ? (
                  <div className="text-muted-foreground flex flex-col gap-0.5 text-[10px]">
                    <span>
                      e.g.{' '}
                      {namePreview.names.slice(0, 3).map((n, i) => (
                        <React.Fragment key={n}>
                          {i > 0 ? ', ' : ''}
                          <code className="font-mono">{n}</code>
                        </React.Fragment>
                      ))}
                      {namePreview.names.length > 3
                        ? ` +${namePreview.names.length - 3} more`
                        : ''}
                    </span>
                    {nameTemplate.trim() ? null : (
                      <span>
                        No pattern set — the document title is used and
                        duplicates are numbered. Add a pattern like{' '}
                        <code className="font-mono">
                          {variables[0] ? `{{${variables[0].key}}}` : '{{key}}'}
                        </code>{' '}
                        for meaningful names.
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* ------------------------- progress ------------------------- */}
          {progress && (
            <div className="mt-3 flex flex-col gap-1.5 rounded-lg border p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {progress.phase === 'building'
                    ? 'Building PDFs'
                    : progress.phase === 'packing'
                      ? 'Packing zip'
                      : progress.phase === 'uploading'
                        ? 'Saving to storage'
                        : 'Done'}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {progress.done} / {progress.total}
                </span>
              </div>
              <Progress
                value={
                  progress.total ? (progress.done / progress.total) * 100 : 0
                }
              />
              <p className="text-muted-foreground truncate font-mono text-[10px]">
                {progress.current}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {mode === 'bulk' && paste.trim() && records.length === 0 ? (
            <p className="text-muted-foreground mr-auto flex items-center gap-1.5 text-[10px]">
              <AlertCircle className="h-3.5 w-3.5" />
              No data rows found below the header row.
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Close
          </Button>

          <Button
            type="button"
            onClick={handleRun}
            disabled={busy || !canRun}
            className="gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Working…
              </>
            ) : mode === 'bulk' ? (
              <>
                <FileArchive className="h-4 w-4" />
                {records.length > 0
                  ? `Generate ${records.length} PDFs + zip`
                  : 'Bulk generate'}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*  Store toggle                                                               */
/* -------------------------------------------------------------------------- */

function StoreToggle({
  store,
  setStore,
  busy,
  compact,
}: {
  store: boolean
  setStore: (v: boolean) => void
  busy: boolean
  compact?: boolean
}) {
  return (
    <label
      className={
        compact
          ? 'text-muted-foreground flex items-center gap-2 text-[11px]'
          : 'text-muted-foreground mt-1 flex items-center gap-2 text-[11px]'
      }
    >
      <Switch
        checked={store}
        onCheckedChange={setStore}
        disabled={busy}
        size="sm"
      />
      Save a copy to storage
    </label>
  )
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatCount(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`
}
