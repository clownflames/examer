'use client'

import * as React from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  Strikethrough,
  Underline,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/* -------------------------------------------------------------------------- */
/*  Section                                                                    */
/* -------------------------------------------------------------------------- */

export function StyleSection({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-muted/50 flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors"
      >
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          {title}
        </span>
        <span className="flex items-center gap-1.5">
          {badge}
          <svg
            viewBox="0 0 12 12"
            className={`text-muted-foreground h-3 w-3 transition-transform ${
              open ? 'rotate-90' : ''
            }`}
            aria-hidden
          >
            <path
              d="M4 2l4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>
      {open && <div className="flex flex-col gap-2.5 px-3 pb-3">{children}</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Row / grid helpers                                                         */
/* -------------------------------------------------------------------------- */

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-muted-foreground text-[10px] font-medium">
      {children}
    </Label>
  )
}

/* -------------------------------------------------------------------------- */
/*  Inputs                                                                     */
/* -------------------------------------------------------------------------- */

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value)
            onChange(Number.isFinite(n) ? n : 0)
          }}
          className="h-7 pr-6 text-xs"
        />
        {suffix ? (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px]">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-7 text-xs ${mono ? 'font-mono text-[10px]' : ''}`}
      />
    </div>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <Textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="resize-y text-xs"
      />
    </div>
  )
}

export function ColorField({
  label,
  value,
  onChange,
  allowTransparent = true,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  allowTransparent?: boolean
}) {
  const isTransparent = !value || value === 'transparent'
  const swatch = isTransparent ? '#ffffff' : value

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-1.5">
        <span className="relative inline-flex">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(swatch) ? swatch : '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-8 cursor-pointer rounded border p-0"
            aria-label={label}
          />
          {isTransparent ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] text-red-600">
              ∅
            </span>
          ) : null}
        </span>
        <Input
          value={isTransparent ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={allowTransparent ? 'transparent' : '#000000'}
          className="h-7 flex-1 font-mono text-[10px]"
        />
        {allowTransparent ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => onChange('transparent')}
            title="Clear"
          >
            <span className="text-xs">⨯</span>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="h-7 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function SwitchField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  return (
    <label className="hover:bg-muted/40 flex cursor-pointer items-center justify-between gap-3 rounded px-1 py-1">
      <span className="flex flex-col">
        <span className="text-xs font-medium">{label}</span>
        {hint ? (
          <span className="text-muted-foreground text-[10px]">{hint}</span>
        ) : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

/* -------------------------------------------------------------------------- */
/*  Segmented / icon button groups                                             */
/* -------------------------------------------------------------------------- */

export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <div className="bg-muted/60 flex rounded-md border p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
              value === o.value
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const ALIGN_ICONS = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
  justify: AlignJustify,
} as const

export function AlignField({
  value,
  onChange,
  options = ['left', 'center', 'right', 'justify'],
}: {
  value: string
  onChange: (v: 'left' | 'center' | 'right' | 'justify') => void
  options?: ('left' | 'center' | 'right' | 'justify')[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>Alignment</FieldLabel>
      <div className="bg-muted/60 flex rounded-md border p-0.5">
        {options.map((o) => {
          const Icon = ALIGN_ICONS[o]
          return (
            <button
              key={o}
              type="button"
              title={o}
              onClick={() => onChange(o)}
              className={`flex flex-1 items-center justify-center rounded py-1 transition-colors ${
                value === o
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ToggleRow({
  bold,
  italic,
  underline,
  strike,
  onToggle,
}: {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  onToggle: (key: 'bold' | 'italic' | 'underline' | 'strike') => void
}) {
  const items = [
    { key: 'bold' as const, icon: Bold, active: bold, title: 'Bold' },
    { key: 'italic' as const, icon: Italic, active: italic, title: 'Italic' },
    {
      key: 'underline' as const,
      icon: Underline,
      active: underline,
      title: 'Underline',
    },
    {
      key: 'strike' as const,
      icon: Strikethrough,
      active: strike,
      title: 'Strikethrough',
    },
  ]

  return (
    <div className="flex gap-1">
      {items.map((it) => (
        <Button
          key={it.key}
          type="button"
          size="icon"
          variant={it.active ? 'secondary' : 'ghost'}
          onClick={() => onToggle(it.key)}
          title={it.title}
          aria-label={it.title}
          className="h-7 w-7"
        >
          <it.icon className="h-3.5 w-3.5" />
        </Button>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Spacing box (4 sides, optionally linked)                                    */
/* -------------------------------------------------------------------------- */

export type SpacingSides = {
  top: number
  right: number
  bottom: number
  left: number
}

export function SpacingBox({
  label,
  value,
  onChange,
  max = 200,
}: {
  label: string
  value: SpacingSides
  onChange: (v: SpacingSides) => void
  max?: number
}) {
  const [linked, setLinked] = React.useState(
    value.top === value.right &&
      value.right === value.bottom &&
      value.bottom === value.left
  )

  const sides: (keyof SpacingSides)[] = ['top', 'right', 'bottom', 'left']
  const glyph: Record<keyof SpacingSides, string> = {
    top: 'T',
    right: 'R',
    bottom: 'B',
    left: 'L',
  }

  function setSide(side: keyof SpacingSides, v: number) {
    if (linked) {
      onChange({ top: v, right: v, bottom: v, left: v })
      return
    }
    onChange({ ...value, [side]: v })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <button
          type="button"
          onClick={() => {
            const next = !linked
            setLinked(next)
            if (next) onChange({ top: value.top, right: value.top, bottom: value.top, left: value.top })
          }}
          className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${
            linked
              ? 'border-primary bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted'
          }`}
          title={linked ? 'Unlink sides' : 'Link all sides'}
        >
          {linked ? 'LINKED' : 'UNLINKED'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {sides.map((side) => (
          <div key={side} className="relative">
            <Input
              type="number"
              value={value[side]}
              max={max}
              onChange={(e) => {
                const n = Number(e.target.value)
                setSide(side, Number.isFinite(n) ? n : 0)
              }}
              className="h-7 pr-4 pl-4 text-[11px]"
            />
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-1.5 -translate-y-1/2 text-[9px] font-semibold">
              {glyph[side]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  String array editor (list items, table headers)                            */
/* -------------------------------------------------------------------------- */

export function StringListEditor({
  label,
  items,
  onChange,
  addLabel = 'Add item',
  min = 1,
}: {
  label: string
  items: string[]
  onChange: (v: string[]) => void
  addLabel?: string
  min?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-muted-foreground w-4 shrink-0 text-center text-[9px]">
              {i + 1}
            </span>
            <Input
              value={item}
              onChange={(e) => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
              className="h-7 text-xs"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-destructive h-7 w-7 shrink-0"
              disabled={items.length <= min}
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              aria-label={`Remove ${label} ${i + 1}`}
            >
              <span className="text-xs">−</span>
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => onChange([...items, `Item ${items.length + 1}`])}
      >
        + {addLabel}
      </Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Misc                                                                       */
/* -------------------------------------------------------------------------- */

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-[10px] leading-relaxed">{children}</p>
}

export function LinkRow({
  href,
  onOpen,
}: {
  href: string
  onOpen: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 w-full justify-start gap-2 text-xs"
      onClick={onOpen}
    >
      <Link2 className="h-3.5 w-3.5" />
      <span className="truncate">{href}</span>
    </Button>
  )
}
