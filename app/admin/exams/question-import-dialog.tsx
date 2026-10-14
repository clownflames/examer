'use client'

import * as React from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  ACCEPTED_FILE_TYPES,
  isSpreadsheetFile,
  readSpreadsheetFile,
} from '@/app/admin/documents-studio/_lib/sheet'
import { downloadTextFile, parseDelimited } from '@/lib/csv'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { importQuestions } from './questions-actions'
import { QUESTION_TYPE_LABELS } from './questions-constants'
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  buildQuestionSampleCsv,
  collectValidInputs,
  parseQuestionRows,
  questionTemplateFileName,
  type ParseResult,
} from './questions-import'

const PREVIEW_LIMIT = 8

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  examId: string
  examName: string
  onImported: () => void | Promise<void>
}

export function QuestionImportDialog({
  open,
  onOpenChange,
  examId,
  examName,
  onImported,
}: Props) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = React.useState(false)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ParseResult | null>(null)
  const [reading, setReading] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [showFormat, setShowFormat] = React.useState(false)

  const busy = reading || importing

  const reset = React.useCallback(() => {
    setFileName(null)
    setResult(null)
    setDragging(false)
  }, [])

  // Never leave a stale file behind when the dialog is dismissed mid-upload.
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (importing) return
      if (!next) reset()
      onOpenChange(next)
    },
    [importing, onOpenChange, reset]
  )

  const handleFile = React.useCallback(
    async (file: File) => {
      if (!isSpreadsheetFile(file)) {
        toast.error('Unsupported file', {
          description: 'Use a .csv, .tsv, .txt or .xlsx file.',
        })
        return
      }

      setReading(true)
      try {
        const read = await readSpreadsheetFile(file)
        if (!read.ok) {
          toast.error('Could not read that file', { description: read.error })
          return
        }

        const table = parseDelimited(read.text)
        if (table.headers.length === 0 || table.rows.length === 0) {
          toast.error('That file has no rows to import.')
          return
        }

        if (table.rows.length > MAX_IMPORT_ROWS) {
          toast.warning(`Only the first ${MAX_IMPORT_ROWS} rows will be imported.`, {
            description: `The file has ${table.rows.length} rows.`,
          })
        }

        const parsed = parseQuestionRows(
          table.headers,
          table.rows.slice(0, MAX_IMPORT_ROWS)
        )

        setFileName(file.name)
        setResult(parsed)

        if (parsed.missingRequiredColumn) {
          toast.error('No “Question” column found', {
            description:
              'Keep the header row, and name the column Question / Question Text.',
          })
        }
      } catch (err) {
        console.error('Question import read failed:', err)
        toast.error('Could not read that file.')
      } finally {
        setReading(false)
      }
    },
    []
  )

  const handleDownloadTemplate = React.useCallback(() => {
    downloadTextFile(buildQuestionSampleCsv(), questionTemplateFileName(examName))
    toast.success('Template downloaded.', {
      description: 'Fill in the rows, then upload the file back.',
    })
  }, [examName])

  const handleImport = async () => {
    if (!result) return
    const inputs = collectValidInputs(result.rows)
    if (inputs.length === 0) return

    setImporting(true)
    try {
      const response = await importQuestions(examId, inputs)
      if (!response.success) {
        toast.error(response.error ?? 'Import failed.')
        return
      }

      await onImported()
      toast.success(`${response.imported} question${response.imported === 1 ? '' : 's'} added.`, {
        description:
          result.invalidCount > 0
            ? `${result.invalidCount} row${result.invalidCount === 1 ? '' : 's'} skipped — see the preview.`
            : undefined,
      })
      handleOpenChange(false)
    } catch (err) {
      console.error('Question import failed:', err)
      toast.error('Import failed.')
    } finally {
      setImporting(false)
    }
  }

  const previewRows = result?.rows.slice(0, PREVIEW_LIMIT) ?? []
  const hiddenRows = (result?.rows.length ?? 0) - previewRows.length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-4 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import questions</DialogTitle>
          <DialogDescription>
            Add every question at once from a CSV or Excel file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {/* ---------------- step 1 ---------------- */}
          <section className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-medium">
                  <span className="text-muted-foreground mr-1.5 font-mono">1</span>
                  Download the sample
                </span>
                <span className="text-muted-foreground text-xs">
                  Not sure about the columns? Start from the template.
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                disabled={busy}
                onClick={handleDownloadTemplate}
              >
                <FileDown className="h-3 w-3" />
                Download sample
              </Button>
            </div>
          </section>

          {/* ---------------- step 2 ---------------- */}
          <section className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-medium">
                  <span className="text-muted-foreground mr-1.5 font-mono">2</span>
                  Fill it in and upload
                </span>
                <span className="text-muted-foreground text-xs">
                  Keep the header row exactly as it is in the sample.
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {reading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                Upload file
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
                // Allow re-picking the same file after an edit.
                e.target.value = ''
              }}
            />

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
              className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-4 text-center transition-colors ${
                dragging ? 'border-primary bg-primary/5' : 'border-input'
              }`}
            >
              {reading ? (
                <>
                  <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground text-xs">Reading file…</span>
                </>
              ) : fileName ? (
                <>
                  <FileSpreadsheet className="text-muted-foreground h-4 w-4" />
                  <span className="text-xs font-medium">{fileName}</span>
                  <span className="text-muted-foreground text-[11px]">
                    Drop another file to replace it.
                  </span>
                </>
              ) : (
                <>
                  <Upload className="text-muted-foreground h-4 w-4" />
                  <span className="text-xs">Drop a .csv or .xlsx file here</span>
                  <span className="text-muted-foreground text-[11px]">
                    Accepts .csv, .tsv, .txt and .xlsx
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFormat((v) => !v)}
              className="text-muted-foreground hover:text-foreground self-start text-[11px] underline underline-offset-2"
            >
              {showFormat ? 'Hide column guide' : 'Show column guide'}
            </button>

            {showFormat && (
              <ul className="flex flex-col gap-1 rounded-md border p-2 text-[11px]">
                {IMPORT_COLUMNS.map((column) => (
                  <li key={column.key} className="flex gap-2">
                    <code className="bg-muted shrink-0 rounded px-1 py-px font-mono">
                      {column.label}
                    </code>
                    <span className="text-muted-foreground">
                      {column.required ? 'Required.' : 'Optional.'}
                      {column.hint ? ` ${column.hint}.` : ''}
                    </span>
                  </li>
                ))}
                <li className="text-muted-foreground mt-1 border-t pt-1">
                  Leave <strong>Type</strong> blank and it is detected for you: any
                  option filled in becomes an MCQ, otherwise a text question.
                </li>
              </ul>
            )}
          </section>

          {/* ---------------- preview ---------------- */}
          {result && (
            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium">Preview</span>
                {result.validCount > 0 && (
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-500" />
                    {result.validCount} ready
                  </Badge>
                )}
                {result.invalidCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="gap-1 text-[11px]"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {result.invalidCount} with errors
                  </Badge>
                )}
              </div>

              {result.missingRequiredColumn && (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 p-2 text-[11px]">
                  <AlertCircle className="mt-px h-3 w-3 shrink-0" />
                  No column named “Question” was found. Rename one of the headers
                  to <code className="font-mono">Question</code> and upload again.
                </p>
              )}

              {result.invalidCount > 0 && !result.missingRequiredColumn && (
                <p className="text-muted-foreground text-[11px]">
                  Rows with errors are skipped. Fix them in the file and upload
                  again, or import the valid rows now.
                </p>
              )}

              <div className="overflow-hidden rounded-md border">
                <table className="w-full table-fixed text-left text-[11px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-muted-foreground w-12 px-2 py-1.5 font-medium">
                        Row
                      </th>
                      <th className="px-2 py-1.5 font-medium">Question</th>
                      <th className="text-muted-foreground w-24 px-2 py-1.5 font-medium">
                        Type
                      </th>
                      <th className="text-muted-foreground w-14 px-2 py-1.5 text-right font-medium">
                        Marks
                      </th>
                      <th className="text-muted-foreground w-20 px-2 py-1.5 text-right font-medium">
                        Options
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr
                        key={row.line}
                        className="border-t align-top"
                      >
                        <td className="text-muted-foreground px-2 py-1.5 font-mono">
                          {row.line}
                        </td>
                        <td className="px-2 py-1.5">
                          {row.error ? (
                            <span className="text-destructive flex items-start gap-1">
                              <AlertCircle className="mt-px h-3 w-3 shrink-0" />
                              <span>{row.error}</span>
                            </span>
                          ) : (
                            <span className="line-clamp-2">
                              {row.preview.name || '—'}
                              {row.preview.warnings.map((warning) => (
                                <span
                                  key={warning}
                                  className="text-muted-foreground ml-1.5 text-[10px]"
                                >
                                  ({warning})
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="text-muted-foreground px-2 py-1.5">
                          {QUESTION_TYPE_LABELS[row.preview.type]}
                        </td>
                        <td className="text-muted-foreground px-2 py-1.5 text-right font-mono">
                          {row.preview.marks}
                        </td>
                        <td className="text-muted-foreground px-2 py-1.5 text-right">
                          {row.preview.options.length > 0
                            ? row.preview.options
                                .map((o) => (o.isCorrect ? '✓' : '·'))
                                .join('')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hiddenRows > 0 && (
                <p className="text-muted-foreground text-[11px]">
                  + {hiddenRows} more row{hiddenRows === 1 ? '' : 's'} not shown.
                </p>
              )}
            </section>
          )}
        </div>

        <DialogFooter>
          {result && result.validCount > 0 ? (
            <Button
              type="button"
              onClick={handleImport}
              disabled={busy || result.missingRequiredColumn}
            >
              {importing ? <Loader2 className="animate-spin" /> : <Upload />}
              {importing
                ? 'Importing…'
                : `Import ${result.validCount} question${result.validCount === 1 ? '' : 's'}`}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}