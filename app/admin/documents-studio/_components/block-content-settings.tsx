'use client'

import * as React from 'react'

import { BLOCK_META, type BlockKind } from '../constants'
import {
  arr,
  num,
  str,
} from '../_lib/style'
import { MediaPicker } from '@/app/admin/documents/_components/media-picker'
import { HEADING_LEVEL_SIZE } from './blocks/heading-block'
import {
  AlignField,
  ColorField,
  Hint,
  NumberField,
  Row,
  SegmentedField,
  SelectField,
  StringListEditor,
  StyleSection,
  SwitchField,
  TextAreaField,
  TextField,
} from './style-controls'

type Props = Record<string, unknown>

export type SetProp = (key: string, value: unknown) => void

/* -------------------------------------------------------------------------- */
/*  Per-kind content editors                                                  */
/* -------------------------------------------------------------------------- */

function ContentSection({
  kind,
  props,
  setProp,
}: {
  kind: BlockKind
  props: Props
  setProp: SetProp
}) {
  switch (kind) {
    /* ---------------- text ---------------- */
    case 'text':
      return (
        <StyleSection title="Content">
          <TextAreaField
            label="Text"
            value={str(props.text)}
            onChange={(v) => setProp('text', v)}
            rows={5}
            placeholder="Type here…"
          />
        </StyleSection>
      )

    /* ---------------- heading ---------------- */
    case 'heading':
      return (
        <StyleSection title="Content">
          <TextAreaField
            label="Heading text"
            value={str(props.text)}
            onChange={(v) => setProp('text', v)}
            rows={3}
          />
          <SelectField
            label="Level"
            value={String(props.level ?? 1)}
            options={[
              { value: '1', label: 'H1 — page title (32px)' },
              { value: '2', label: 'H2 — section (25px)' },
              { value: '3', label: 'H3 — subsection (20px)' },
              { value: '4', label: 'H4 — minor (17px)' },
            ]}
            onChange={(v) => {
              const level = Number(v)
              // Reset any manual size override so the level preset applies.
              setProp('level', level)
              setProp('customSize', false)
              setProp('fontSize', HEADING_LEVEL_SIZE[level])
            }}
          />
          {props.customSize === true ? (
            <Hint>
              The font size was set manually, so this heading no longer
              follows its level size.
            </Hint>
          ) : null}
        </StyleSection>
      )

    /* ---------------- list ---------------- */
    case 'list':
      return (
        <>
          <StyleSection title="List type">
            <SegmentedField
              value={props.ordered === true ? 'ordered' : 'bullet'}
              options={[
                { value: 'bullet', label: 'Bulleted' },
                { value: 'ordered', label: 'Numbered' },
              ]}
              onChange={(v) => setProp('ordered', v === 'ordered')}
            />
            <Row>
              <NumberField
                label="Indent"
                value={num(props.indent, 24)}
                onChange={(v) => setProp('indent', v)}
                min={0}
                suffix="px"
              />
              <NumberField
                label="Item gap"
                value={num(props.itemGap, 4)}
                onChange={(v) => setProp('itemGap', v)}
                min={0}
                suffix="px"
              />
            </Row>
          </StyleSection>
          <StyleSection title="Items">
            <StringListEditor
              label="List items"
              items={arr<string>(props.items)}
              onChange={(v) => setProp('items', v)}
              addLabel="Add item"
            />
          </StyleSection>
        </>
      )

    /* ---------------- button ---------------- */
    case 'button':
      return (
        <StyleSection title="Button">
          <TextField
            label="Label"
            value={str(props.text)}
            onChange={(v) => setProp('text', v)}
          />
          <TextField
            label="Link URL"
            value={str(props.href)}
            onChange={(v) => setProp('href', v)}
            placeholder="https://…"
            mono
          />
          <SegmentedField
            label="Variant"
            value={(props.variant as string) ?? 'solid'}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'outline', label: 'Outline' },
            ]}
            onChange={(v) => setProp('variant', v)}
          />
          <Row>
            <NumberField
              label="Pad X"
              value={num(props.padX, 18)}
              onChange={(v) => setProp('padX', v)}
              min={0}
              suffix="px"
            />
            <NumberField
              label="Pad Y"
              value={num(props.padY, 10)}
              onChange={(v) => setProp('padY', v)}
              min={0}
              suffix="px"
            />
          </Row>
          <ColorField
            label="Fill colour"
            value={str(props.backgroundColor, '#4f46e5')}
            onChange={(v) => setProp('backgroundColor', v)}
          />
          <ColorField
            label="Label colour"
            value={str(props.color, '#ffffff')}
            onChange={(v) => setProp('color', v)}
          />
          <ColorField
            label="Outline colour"
            value={str(props.borderColor, '#4f46e5')}
            onChange={(v) => setProp('borderColor', v)}
          />
        </StyleSection>
      )

    /* ---------------- image ---------------- */
    case 'image':
      return (
        <StyleSection title="Image">
          <MediaPicker
            value={str(props.src) || null}
            onChange={(url) => setProp('src', url)}
            label="Media library"
          />
          <TextField
            label="Or paste a URL"
            value={str(props.src)}
            onChange={(v) => setProp('src', v)}
            placeholder="https://…"
            mono
          />
          <TextField
            label="Alt text"
            value={str(props.alt)}
            onChange={(v) => setProp('alt', v)}
          />
        </StyleSection>
      )

    /* ---------------- qr ---------------- */
    case 'qr':
      return (
        <StyleSection title="QR code">
          <TextAreaField
            label="Encoded value"
            value={str(props.value)}
            onChange={(v) => setProp('value', v)}
            rows={2}
            placeholder="https://…"
          />
          <NumberField
            label="Size"
            value={num(props.size, 120)}
            onChange={(v) => setProp('size', v)}
            min={40}
            max={600}
            suffix="px"
          />
        </StyleSection>
      )

    /* ---------------- table ---------------- */
    case 'table':
      return <TableContent props={props} setProp={setProp} />

    /* ---------------- divider ---------------- */
    case 'divider':
      return (
        <StyleSection title="Line">
          <Row>
            <NumberField
              label="Thickness"
              value={num(props.thickness, 1)}
              onChange={(v) => setProp('thickness', v)}
              min={1}
              max={20}
              suffix="px"
            />
            <NumberField
              label="Length"
              value={num(props.length, 100)}
              onChange={(v) => setProp('length', v)}
              min={5}
              max={100}
              suffix="%"
            />
          </Row>
          <ColorField
            label="Line colour"
            value={str(props.lineColor, '#d4d4d8')}
            onChange={(v) => setProp('lineColor', v)}
            allowTransparent={false}
          />
          <SelectField
            label="Dash style"
            value={str(props.dash, 'none')}
            options={[
              { value: 'none', label: 'Solid' },
              { value: 'dashed', label: 'Dashed' },
              { value: 'dotted', label: 'Dotted' },
            ]}
            onChange={(v) => setProp('dash', v)}
          />
        </StyleSection>
      )

    /* ---------------- spacer ---------------- */
    case 'spacer':
      return (
        <StyleSection title="Spacer">
          <NumberField
            label="Height"
            value={num(props.height, 32)}
            onChange={(v) => setProp('height', v)}
            min={1}
            max={2000}
            suffix="px"
          />
        </StyleSection>
      )

    /* ---------------- columns ---------------- */
    case 'columns':
      return <ColumnsContent props={props} setProp={setProp} />

    /* ---------------- page break ---------------- */
    case 'pageBreak':
      return (
        <StyleSection title="Page break">
          <TextField
            label="Guide label"
            value={str(props.label, 'Page break')}
            onChange={(v) => setProp('label', v)}
          />
          <Hint>
            Content after this block starts on a fresh page in the exported
            PDF. On the canvas it is drawn as a dashed guide.
          </Hint>
        </StyleSection>
      )

    /* ---------------- signature ---------------- */
    case 'signature':
      return (
        <StyleSection title="Signature">
          <TextField
            label="Name"
            value={str(props.name)}
            onChange={(v) => setProp('name', v)}
          />
          <TextField
            label="Role / title"
            value={str(props.role)}
            onChange={(v) => setProp('role', v)}
          />
          <TextField
            label="Date"
            value={str(props.date)}
            onChange={(v) => setProp('date', v)}
            placeholder="DD / MM / YYYY"
          />
          <MediaPicker
            value={str(props.imageUrl) || null}
            onChange={(url) => setProp('imageUrl', url)}
            label="Signature image"
          />
          <Row>
            <NumberField
              label="Line width"
              value={num(props.lineWidth, 200)}
              onChange={(v) => setProp('lineWidth', v)}
              min={80}
              max={600}
              suffix="px"
            />
            <SelectField
              label="Detail layout"
              value={str(props.layout, 'below')}
              options={[
                { value: 'below', label: 'Below line' },
                { value: 'above', label: 'Above line' },
              ]}
              onChange={(v) => setProp('layout', v)}
            />
          </Row>
          <ColorField
            label="Line colour"
            value={str(props.lineColor, '#71717a')}
            onChange={(v) => setProp('lineColor', v)}
            allowTransparent={false}
          />
        </StyleSection>
      )

    /* ---------------- box ---------------- */
    case 'box':
      return (
        <StyleSection title="Box">
          <SegmentedField
            label="Shape"
            value={str(props.shape, 'rect')}
            options={[
              { value: 'rect', label: 'Rect' },
              { value: 'rounded', label: 'Round' },
              { value: 'pill', label: 'Pill' },
              { value: 'circle', label: 'Circle' },
              { value: 'bar', label: 'Bar' },
            ]}
            onChange={(v) => setProp('shape', v)}
          />
          <Row>
            <NumberField
              label="Height"
              value={num(props.height)}
              onChange={(v) => setProp('height', v)}
              min={0}
              max={1200}
              suffix="px"
            />
            <NumberField
              label="Min height"
              value={num(props.minHeight, 40)}
              onChange={(v) => setProp('minHeight', v)}
              min={8}
              max={1200}
              suffix="px"
            />
          </Row>
          <TextAreaField
            label="Text inside"
            value={str(props.text)}
            onChange={(v) => setProp('text', v)}
            rows={3}
            placeholder="Optional"
          />
          <Row>
            <NumberField
              label="Text size"
              value={num(props.textSize, 14)}
              onChange={(v) => setProp('textSize', v)}
              min={6}
              max={72}
              suffix="px"
            />
            <NumberField
              label="Text pad"
              value={num(props.textPadding, 12)}
              onChange={(v) => setProp('textPadding', v)}
              min={0}
              max={120}
              suffix="px"
            />
          </Row>
          <AlignField
            value={str(props.textAlign, 'center')}
            onChange={(v) => setProp('textAlign', v)}
            options={['left', 'center', 'right']}
          />
          <ColorField
            label="Text colour"
            value={str(props.textColor, '#18181b')}
            onChange={(v) => setProp('textColor', v)}
            allowTransparent={false}
          />
        </StyleSection>
      )

    default:
      return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Table                                                                      */
/* -------------------------------------------------------------------------- */

function TableContent({ props, setProp }: { props: Props; setProp: SetProp }) {
  const headers = arr<string>(props.headers)
  const rows = arr<string[]>(props.rows)

  function setColumnWidths(next: number[]) {
    setProp('columnWidths', next)
  }

  return (
    <>
      <StyleSection title="Table">
        <SwitchField
          label="Header row"
          checked={props.hasHeader !== false}
          onChange={(v) => setProp('hasHeader', v)}
        />
        <SwitchField
          label="Zebra stripes"
          checked={props.striped === true}
          onChange={(v) => setProp('striped', v)}
        />
        <NumberField
          label="Cell padding"
          value={num(props.cellPadding, 8)}
          onChange={(v) => setProp('cellPadding', v)}
          min={2}
          max={40}
          suffix="px"
        />
      </StyleSection>

      <StyleSection title="Columns">
        <div className="flex flex-col gap-1.5">
          {headers.map((h, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-muted-foreground w-4 shrink-0 text-center text-[9px]">
                {i + 1}
              </span>
              <InputLike
                value={h}
                onChange={(v) => {
                  const next = [...headers]
                  next[i] = v
                  setProp('headers', next)
                }}
              />
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive h-7 w-6 shrink-0 text-xs"
                disabled={headers.length <= 1}
                onClick={() => {
                  setProp(
                    'headers',
                    headers.filter((_, idx) => idx !== i)
                  )
                  setProp(
                    'rows',
                    rows.map((r) => r.filter((_, idx) => idx !== i))
                  )
                }}
                aria-label={`Remove column ${i + 1}`}
              >
                −
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="hover:bg-muted h-7 flex-1 rounded border text-[11px]"
            onClick={() => {
              setProp('headers', [...headers, `Col ${headers.length + 1}`])
              setProp(
                'rows',
                rows.map((r) => [...r, ''])
              )
            }}
          >
            + Column
          </button>
          <button
            type="button"
            className="hover:bg-muted h-7 flex-1 rounded border text-[11px]"
            onClick={() => setProp('rows', [...rows, new Array(headers.length).fill('')])}
          >
            + Row
          </button>
        </div>
      </StyleSection>

      <StyleSection title="Column widths" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-1.5">
          {headers.map((h, i) => {
            const widths = arr<number>(props.columnWidths)
            const current =
              Number(widths[i]) > 0
                ? Number(widths[i])
                : Math.round((100 / Math.max(1, headers.length)) * 10) / 10
            return (
              <NumberField
                key={i}
                label={h || `Col ${i + 1}`}
                value={current}
                step={5}
                min={1}
                max={100}
                suffix="%"
                onChange={(v) => {
                  const next = [...widths]
                  while (next.length < headers.length) next.push(0)
                  next[i] = v
                  setColumnWidths(next)
                }}
              />
            )
          })}
        </div>
        <Hint>
          Percentages are relative — they do not have to add up to 100, the
          remaining space is distributed evenly.
        </Hint>
      </StyleSection>

      <StyleSection title="Rows" defaultOpen={false}>
        <div className="flex flex-col gap-2">
          {rows.map((row, ri) => (
            <div key={ri} className="bg-muted/40 flex flex-col gap-1 rounded p-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                  Row {ri + 1}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive text-xs"
                  disabled={rows.length <= 1}
                  onClick={() =>
                    setProp(
                      'rows',
                      rows.filter((_, idx) => idx !== ri)
                    )
                  }
                  aria-label={`Remove row ${ri + 1}`}
                >
                  −
                </button>
              </div>
              {row.map((cell, ci) => (
                <InputLike
                  key={ci}
                  value={cell}
                  placeholder={`Col ${ci + 1}`}
                  onChange={(v) => {
                    const next = rows.map((r) => [...r])
                    next[ri][ci] = v
                    setProp('rows', next)
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </StyleSection>
    </>
  )
}

function InputLike({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="border-input bg-background h-7 min-w-0 flex-1 rounded border px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  Columns                                                                    */
/* -------------------------------------------------------------------------- */

function ColumnsContent({ props, setProp }: { props: Props; setProp: SetProp }) {
  const count = Math.max(1, Math.min(4, Math.round(num(props.count, 2))))
  const widths = arr<number>(props.widths)

  return (
    <>
      <StyleSection title="Layout">
        <SegmentedField
          label="Columns"
          value={String(count)}
          options={[
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4', label: '4' },
          ]}
          onChange={(v) => {
            const next = Number(v)
            setProp('count', next)
            const resized = Array.from({ length: next }, (_, i) => {
              const w = Number(widths[i])
              return w > 0 ? w : Math.round((100 / next) * 10) / 10
            })
            setProp('widths', resized)
          }}
        />
        <Row>
          <NumberField
            label="Gap"
            value={num(props.gap, 20)}
            onChange={(v) => setProp('gap', v)}
            min={0}
            max={120}
            suffix="px"
          />
          <NumberField
            label="Min height"
            value={num(props.minHeight, 90)}
            onChange={(v) => setProp('minHeight', v)}
            min={20}
            max={800}
            suffix="px"
          />
        </Row>
        <SwitchField
          label="Show column guides"
          checked={props.showGuides !== false}
          onChange={(v) => setProp('showGuides', v)}
        />
      </StyleSection>

      <StyleSection title="Column widths" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-1.5">
          {Array.from({ length: count }, (_, i) => {
            const w = Number(widths[i])
            return (
              <NumberField
                key={i}
                label={`Column ${i + 1}`}
                value={w > 0 ? w : Math.round((100 / count) * 10) / 10}
                step={5}
                min={1}
                max={100}
                suffix="%"
                onChange={(v) => {
                  const next = Array.from({ length: count }, (_, idx) => {
                    const existing = Number(widths[idx])
                    return existing > 0 ? existing : Math.round((100 / count) * 10) / 10
                  })
                  next[i] = v
                  setProp('widths', next)
                }}
              />
            )
          })}
        </div>
      </StyleSection>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Export                                                                     */
/* -------------------------------------------------------------------------- */

/** Renders only the block-specific "content" editors. */
export function BlockContentSettings({
  blockKey,
  props,
  setProp,
}: {
  blockKey: string
  props: Props
  setProp: SetProp
}) {
  const meta = BLOCK_META[blockKey]
  if (!meta) return null
  return <ContentSection kind={meta.kind} props={props} setProp={setProp} />
}
