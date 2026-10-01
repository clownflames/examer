'use client'

import * as React from 'react'
import { Download, ExternalLink, FileText, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  PAGE_PRESETS,
  resolvePageSize,
  type GeneratedFile,
  type PageSetup,
  type PageSizeKey,
} from '../constants'
import {
  ColorField,
  Hint,
  NumberField,
  Row,
  SegmentedField,
  SelectField,
  StyleSection,
  SwitchField,
} from './style-controls'

const PAGE_SIZE_OPTIONS: { value: PageSizeKey; label: string }[] = [
  ...(Object.keys(PAGE_PRESETS) as (keyof typeof PAGE_PRESETS)[]).map((key) => ({
    value: key as PageSizeKey,
    label: PAGE_PRESETS[key].label,
  })),
  { value: 'CUSTOM', label: 'Custom…' },
]

export function PageSettings({
  setup,
  batchFiles = [],
  onChange,
}: {
  setup: PageSetup
  batchFiles?: GeneratedFile[]
  onChange: (patch: Partial<PageSetup>) => void
}) {
  const size = resolvePageSize(setup)
  const mm = (pt: number) => Math.round((pt / 72) * 25.4 * 10) / 10
  const setupBatchFiles = batchFiles

  return (
    <div className="flex flex-col">
      {/* ---------- PDF status ---------- */}
      <StyleSection title="PDF" badge={setup.pdfUrl ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : undefined}>
        {setup.pdfUrl ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
              <FileText className="h-3 w-3" />
              Generated{' '}
              {setup.pdfGeneratedAt
                ? new Date(setup.pdfGeneratedAt).toLocaleString()
                : 'earlier'}
            </p>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 flex-1 gap-1.5 text-[11px]"
                onClick={() => window.open(setup.pdfUrl as string, '_blank', 'noopener')}
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Open in new tab"
                onClick={() => window.open(setup.pdfUrl as string, '_blank', 'noopener')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-destructive h-7 w-7"
                title="Forget stored PDF"
                onClick={() =>
                  onChange({ pdfUrl: null, pdfKey: null, pdfGeneratedAt: null })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <Hint>
            No PDF stored yet. Use <strong>Generate PDF</strong> in the top bar
            to build one — it downloads to your device and a copy is saved to
            storage.
          </Hint>
        )}
      </StyleSection>

      {/* ---------- bulk output ---------- */}
      {setupBatchFiles.length > 0 && (
        <StyleSection title="Bulk output">
          <p className="text-muted-foreground text-[10px]">
            {setupBatchFiles.length} file
            {setupBatchFiles.length === 1 ? '' : 's'} from the last bulk run
            (saved {new Date(setupBatchFiles[0].createdAt).toLocaleString()}).
          </p>
          <div className="max-h-52 overflow-y-auto rounded border">
            {setupBatchFiles.map((file) => (
              <a
                key={file.key}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bg-muted flex items-center gap-2 border-b px-2 py-1.5 text-[11px] last:border-b-0"
              >
                <FileText className="h-3 w-3 shrink-0 opacity-60" />
                <span className="min-w-0 flex-1 truncate">
                  {file.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {formatBytes(file.size)}
                </span>
              </a>
            ))}
          </div>
        </StyleSection>
      )}

      {/* ---------- Page geometry ---------- */}
      <StyleSection title="Page">
        <SelectField
          label="Page size"
          value={setup.pageSize}
          options={PAGE_SIZE_OPTIONS}
          onChange={(v) => onChange({ pageSize: v })}
        />

        {setup.pageSize === 'CUSTOM' && (
          <Row>
            <NumberField
              label="Width"
              value={setup.customWidthPt}
              onChange={(v) => onChange({ customWidthPt: v })}
              min={100}
              max={2000}
              step={1}
              suffix="pt"
            />
            <NumberField
              label="Height"
              value={setup.customHeightPt}
              onChange={(v) => onChange({ customHeightPt: v })}
              min={100}
              max={2000}
              step={1}
              suffix="pt"
            />
          </Row>
        )}

        <SegmentedField
          label="Orientation"
          value={setup.orientation}
          options={[
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ]}
          onChange={(v) =>
            onChange({ orientation: v as 'portrait' | 'landscape' })
          }
        />

        <div className="text-muted-foreground bg-muted/50 rounded border px-2 py-1.5 text-[10px]">
          Canvas <strong className="text-foreground">{size.width} × {size.height}</strong> px
          <br />
          PDF page{' '}
          <strong className="text-foreground">
            {size.widthPt} × {size.heightPt}
          </strong>{' '}
          pt ({mm(size.widthPt)} × {mm(size.heightPt)} mm)
        </div>
      </StyleSection>

      {/* ---------- Margins ---------- */}
      <StyleSection title="Margins">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Top"
            value={setup.marginTop}
            onChange={(v) => onChange({ marginTop: v })}
            min={0}
            max={400}
            suffix="px"
          />
          <NumberField
            label="Right"
            value={setup.marginRight}
            onChange={(v) => onChange({ marginRight: v })}
            min={0}
            max={400}
            suffix="px"
          />
          <NumberField
            label="Bottom"
            value={setup.marginBottom}
            onChange={(v) => onChange({ marginBottom: v })}
            min={0}
            max={400}
            suffix="px"
          />
          <NumberField
            label="Left"
            value={setup.marginLeft}
            onChange={(v) => onChange({ marginLeft: v })}
            min={0}
            max={400}
            suffix="px"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[11px]"
          onClick={() =>
            onChange({
              marginTop: setup.marginTop,
              marginBottom: setup.marginTop,
              marginLeft: setup.marginRight,
              marginRight: setup.marginRight,
            })
          }
        >
          Make all sides equal
        </Button>
      </StyleSection>

      {/* ---------- Appearance ---------- */}
      <StyleSection title="Appearance">
        <ColorField
          label="Page colour"
          value={setup.backgroundColor}
          onChange={(v) => onChange({ backgroundColor: v })}
          allowTransparent={false}
        />
        <SwitchField
          label="Show page guides"
          hint="Dashed lines where each page ends"
          checked={setup.showGuides}
          onChange={(v) => onChange({ showGuides: v })}
        />
        <SwitchField
          label="Page numbers in PDF"
          checked={setup.pageNumbers}
          onChange={(v) => onChange({ pageNumbers: v })}
        />
      </StyleSection>

      {/* ---------- Grid ---------- */}
      <StyleSection title="Grid" defaultOpen={false}>
        <NumberField
          label="Grid size (0 = off)"
          value={setup.gridSize}
          onChange={(v) => onChange({ gridSize: v })}
          min={0}
          max={200}
          suffix="px"
        />
        <SwitchField
          label="Snap to grid"
          hint="Round new sizes to the grid"
          checked={setup.snapToGrid}
          onChange={(v) => onChange({ snapToGrid: v })}
        />
      </StyleSection>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
