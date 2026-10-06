'use client'

import * as React from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List as ListIcon,
  Plus,
  Trash2,
  Underline,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { MediaPicker } from '@/components/admin/media-picker'
import type {
  Align,
  ColumnsBlock,
  DocumentBlock,
  ListBlock,
  ParagraphBlock,
  SignatureBlock,
  TableBlock,
} from '../constants'

/* -------------------------------------------------------------------------- */
/*  Main                                                                       */
/* -------------------------------------------------------------------------- */

export function BlockEditor({
  block,
  onChange,
  onDelete,
}: {
  block: DocumentBlock
  onChange: (next: DocumentBlock) => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Edit · {block.type}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="text-destructive hover:text-destructive h-7 gap-1 px-2"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      {block.type === 'heading' && (
        <>
          <Field label="Text">
            <Input
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
            />
          </Field>

          <Field label="Level">
            <Select
              value={String(block.level)}
              onValueChange={(v) =>
                onChange({ ...block, level: Number(v) as 1 | 2 | 3 })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Heading 1 (largest)</SelectItem>
                <SelectItem value="2">Heading 2</SelectItem>
                <SelectItem value="3">Heading 3 (smallest)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <AlignPicker
            value={block.align}
            onChange={(align) => onChange({ ...block, align })}
          />
        </>
      )}

      {block.type === 'paragraph' && (
        <ParagraphEditor block={block} onChange={onChange} />
      )}

      {block.type === 'image' && (
        <>
          <MediaPicker
            value={block.url || null}
            onChange={(url) => onChange({ ...block, url })}
          />

          <Field label="Width (pt)">
            <Input
              type="number"
              value={block.width ?? 300}
              onChange={(e) =>
                onChange({
                  ...block,
                  width: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </Field>

          <Field label="Alt text (optional)">
            <Input
              value={block.alt ?? ''}
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
            />
          </Field>

          <AlignPicker
            value={block.align}
            onChange={(align) => onChange({ ...block, align })}
          />
        </>
      )}

      {block.type === 'divider' && (
        <p className="text-muted-foreground text-xs">
          A simple horizontal line. No options.
        </p>
      )}

      {block.type === 'spacer' && (
        <Field label="Height (pt)">
          <Input
            type="number"
            value={block.height}
            onChange={(e) =>
              onChange({ ...block, height: Number(e.target.value) || 0 })
            }
          />
        </Field>
      )}

      {block.type === 'list' && (
        <ListEditor block={block} onChange={onChange} />
      )}

      {block.type === 'pageBreak' && (
        <p className="text-muted-foreground text-xs">
          Content after this block starts on a new page.
        </p>
      )}

      {block.type === 'signature' && (
        <SignatureEditor block={block} onChange={onChange} />
      )}

      {block.type === 'qrcode' && (
        <>
          <Field label="Value (URL or text)">
            <Input
              value={block.value}
              onChange={(e) => onChange({ ...block, value: e.target.value })}
              placeholder="https://example.com"
            />
          </Field>

          <Field label="Size (pt)">
            <Input
              type="number"
              value={block.size}
              onChange={(e) =>
                onChange({ ...block, size: Number(e.target.value) || 100 })
              }
            />
          </Field>

          <AlignPicker
            value={block.align}
            onChange={(align) => onChange({ ...block, align })}
          />
        </>
      )}

      {block.type === 'table' && (
        <TableEditor block={block} onChange={onChange} />
      )}

      {block.type === 'columns' && (
        <ColumnsEditor block={block} onChange={onChange} />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Paragraph (rich text)                                                      */
/* -------------------------------------------------------------------------- */

function ParagraphEditor({
  block,
  onChange,
}: {
  block: ParagraphBlock
  onChange: (b: DocumentBlock) => void
}) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null)

  /**
   * Wrap the current selection (or insert at cursor) with a tag.
   * Very simple markdown-ish behaviour on a plain textarea.
   */
  function wrapSelection(openTag: string, closeTag: string) {
    const el = ref.current
    if (!el) return

    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const before = block.html.slice(0, start)
    const selected = block.html.slice(start, end)
    const after = block.html.slice(end)

    const inserted = `${openTag}${selected || 'text'}${closeTag}`
    const next = before + inserted + after
    onChange({ ...block, html: next })

    // Restore cursor after the inserted content
    requestAnimationFrame(() => {
      const pos = before.length + inserted.length
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  function insertLink() {
    const url = window.prompt('Enter URL', 'https://')
    if (!url) return
    wrapSelection(`<a href="${url}">`, '</a>')
  }

  return (
    <>
      <Field label="Text">
        {/* Toolbar */}
        <div className="bg-muted/40 flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 p-1">
          <ToolbarBtn label="Bold" onClick={() => wrapSelection('<b>', '</b>')}>
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            label="Italic"
            onClick={() => wrapSelection('<i>', '</i>')}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            label="Underline"
            onClick={() => wrapSelection('<u>', '</u>')}
          >
            <Underline className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Link" onClick={insertLink}>
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </div>

        <textarea
          ref={ref}
          value={block.html}
          onChange={(e) => onChange({ ...block, html: e.target.value })}
          rows={5}
          className={cn(
            'w-full rounded-b-md border bg-transparent px-3 py-2 text-sm',
            'focus:outline-none focus:ring-1 focus:ring-ring',
            'resize-y'
          )}
        />
      </Field>

      <p className="text-muted-foreground text-[10px]">
        Supports <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>,{' '}
        <code>&lt;u&gt;</code>, <code>&lt;a href&gt;</code>, <code>&lt;br&gt;</code>.
      </p>

      <Field label="Font size (pt)">
        <Input
          type="number"
          value={block.fontSize ?? ''}
          placeholder="Auto"
          onChange={(e) =>
            onChange({
              ...block,
              fontSize: e.target.value
                ? Number(e.target.value)
                : undefined,
            })
          }
        />
      </Field>

      <AlignPicker
        value={block.align}
        onChange={(align) => onChange({ ...block, align })}
      />
    </>
  )
}

function ToolbarBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

function ListEditor({
  block,
  onChange,
}: {
  block: ListBlock
  onChange: (b: DocumentBlock) => void
}) {
  return (
    <>
      <Field label="Style">
        <Select
          value={block.ordered ? 'ordered' : 'bullet'}
          onValueChange={(v) =>
            onChange({ ...block, ordered: v === 'ordered' })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bullet">Bulleted</SelectItem>
            <SelectItem value="ordered">Numbered</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground text-xs font-medium">
          Items
        </Label>
        {block.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-muted-foreground w-4 text-center text-xs">
              {block.ordered ? `${i + 1}.` : '•'}
            </span>
            <Input
              value={item}
              onChange={(e) => {
                const items = [...block.items]
                items[i] = e.target.value
                onChange({ ...block, items })
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive h-8 w-8 shrink-0"
              disabled={block.items.length <= 1}
              onClick={() =>
                onChange({
                  ...block,
                  items: block.items.filter((_, idx) => idx !== i),
                })
              }
              aria-label="Remove item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() =>
            onChange({ ...block, items: [...block.items, 'New item'] })
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Add item
        </Button>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Signature                                                                  */
/* -------------------------------------------------------------------------- */

function SignatureEditor({
  block,
  onChange,
}: {
  block: SignatureBlock
  onChange: (b: DocumentBlock) => void
}) {
  return (
    <>
      <Field label="Name">
        <Input
          value={block.name}
          onChange={(e) => onChange({ ...block, name: e.target.value })}
        />
      </Field>

      <Field label="Role / title (optional)">
        <Input
          value={block.role ?? ''}
          onChange={(e) => onChange({ ...block, role: e.target.value })}
          placeholder="e.g. Program Director"
        />
      </Field>

      <Field label="Date (optional)">
        <Input
          type="date"
          value={block.date ?? ''}
          onChange={(e) => onChange({ ...block, date: e.target.value })}
        />
      </Field>

      <Separator />

      <MediaPicker
        label="Signature image (optional)"
        value={block.imageUrl ?? null}
        onChange={(url) => onChange({ ...block, imageUrl: url || undefined })}
      />

      <AlignPicker
        value={block.align}
        onChange={(align) => onChange({ ...block, align })}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Table                                                                      */
/* -------------------------------------------------------------------------- */

function TableEditor({
  block,
  onChange,
}: {
  block: TableBlock
  onChange: (b: DocumentBlock) => void
}) {
  function updateHeader(i: number, value: string) {
    const headers = [...block.headers]
    headers[i] = value
    onChange({ ...block, headers })
  }

  function updateCell(ri: number, ci: number, value: string) {
    const rows = block.rows.map((r) => [...r])
    rows[ri][ci] = value
    onChange({ ...block, rows })
  }

  function addColumn() {
    const headers = [...block.headers, `Column ${block.headers.length + 1}`]
    const rows = block.rows.map((r) => [...r, ''])
    onChange({ ...block, headers, rows })
  }

  function removeColumn(i: number) {
    if (block.headers.length <= 1) return
    const headers = block.headers.filter((_, idx) => idx !== i)
    const rows = block.rows.map((r) => r.filter((_, idx) => idx !== i))
    onChange({ ...block, headers, rows })
  }

  function addRow() {
    const rows = [
      ...block.rows,
      Array(block.headers.length).fill(''),
    ]
    onChange({ ...block, rows })
  }

  function removeRow(i: number) {
    if (block.rows.length <= 1) return
    onChange({ ...block, rows: block.rows.filter((_, idx) => idx !== i) })
  }

  return (
    <>
      <Field label="Header row">
        <Select
          value={block.hasHeader ? 'yes' : 'no'}
          onValueChange={(v) =>
            onChange({ ...block, hasHeader: v === 'yes' })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Show header</SelectItem>
            <SelectItem value="no">No header</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="flex flex-col gap-3">
        <Label className="text-muted-foreground text-xs font-medium">
          Headers
        </Label>
        {block.headers.map((h, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={h}
              onChange={(e) => updateHeader(i, e.target.value)}
              placeholder={`Header ${i + 1}`}
            />
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive h-8 w-8 shrink-0"
              disabled={block.headers.length <= 1}
              onClick={() => removeColumn(i)}
              aria-label="Remove column"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={addColumn}
        >
          <Plus className="h-3.5 w-3.5" />
          Add column
        </Button>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <Label className="text-muted-foreground text-xs font-medium">
          Rows
        </Label>
        {block.rows.map((row, ri) => (
          <div key={ri} className="bg-muted/30 flex flex-col gap-1.5 rounded-md p-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-medium">
                Row {ri + 1}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive h-6 w-6"
                disabled={block.rows.length <= 1}
                onClick={() => removeRow(ri)}
                aria-label="Remove row"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {row.map((cell, ci) => (
              <Input
                key={ci}
                value={cell}
                onChange={(e) => updateCell(ri, ci, e.target.value)}
                placeholder={`Col ${ci + 1}`}
              />
            ))}
          </div>
        ))}
        <Button size="sm" variant="outline" className="gap-1" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" />
          Add row
        </Button>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Columns                                                                    */
/* -------------------------------------------------------------------------- */

function ColumnsEditor({
  block,
  onChange,
}: {
  block: ColumnsBlock
  onChange: (b: DocumentBlock) => void
}) {
  return (
    <>
      <Field label="Ratio">
        <Select
          value={block.ratio}
          onValueChange={(v) =>
            onChange({ ...block, ratio: v as ColumnsBlock['ratio'] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50-50">50 / 50</SelectItem>
            <SelectItem value="60-40">60 / 40</SelectItem>
            <SelectItem value="40-60">40 / 60</SelectItem>
            <SelectItem value="70-30">70 / 30</SelectItem>
            <SelectItem value="30-70">30 / 70</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Gap (pt)">
        <Input
          type="number"
          value={block.gap}
          onChange={(e) =>
            onChange({ ...block, gap: Number(e.target.value) || 0 })
          }
        />
      </Field>

      <Separator />

      <Field label="Left column">
        <textarea
          value={block.left}
          onChange={(e) => onChange({ ...block, left: e.target.value })}
          rows={4}
          className="w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
        />
      </Field>

      <Field label="Right column">
        <textarea
          value={block.right}
          onChange={(e) => onChange({ ...block, right: e.target.value })}
          rows={4}
          className="w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
        />
      </Field>

      <p className="text-muted-foreground text-[10px]">
        Supports the same inline tags as paragraph (<code>&lt;b&gt;</code>,{' '}
        <code>&lt;i&gt;</code>, etc.).
      </p>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Align picker                                                               */
/* -------------------------------------------------------------------------- */

function AlignPicker({
  value,
  onChange,
}: {
  value: Align
  onChange: (a: Align) => void
}) {
  const options: { value: Align; icon: React.ReactNode; label: string }[] = [
    {
      value: 'left',
      icon: <AlignLeft className="h-3.5 w-3.5" />,
      label: 'Left',
    },
    {
      value: 'center',
      icon: <AlignCenter className="h-3.5 w-3.5" />,
      label: 'Center',
    },
    {
      value: 'right',
      icon: <AlignRight className="h-3.5 w-3.5" />,
      label: 'Right',
    },
  ]

  return (
    <Field label="Align">
      <div className="inline-flex items-center rounded-lg border p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              value === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    </Field>
  )
}

/* -------------------------------------------------------------------------- */
/*  Field wrapper                                                              */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  )
}