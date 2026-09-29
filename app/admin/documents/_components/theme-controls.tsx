'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

import type { DocumentTheme } from '../constants'

export function ThemeControls({
  theme,
  onChange,
}: {
  theme: DocumentTheme
  onChange: (next: DocumentTheme) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        Page & Layout
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Page size">
          <Select
            value={theme.pageSize}
            onValueChange={(v) =>
              onChange({ ...theme, pageSize: v as DocumentTheme['pageSize'] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="LETTER">Letter</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Orientation">
          <Select
            value={theme.orientation}
            onValueChange={(v) =>
              onChange({
                ...theme,
                orientation: v as DocumentTheme['orientation'],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Separator />

      <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        Margins (pt)
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Top">
          <Input
            type="number"
            value={theme.marginTop}
            onChange={(e) =>
              onChange({
                ...theme,
                marginTop: Number(e.target.value) || 0,
              })
            }
          />
        </Field>
        <Field label="Bottom">
          <Input
            type="number"
            value={theme.marginBottom}
            onChange={(e) =>
              onChange({
                ...theme,
                marginBottom: Number(e.target.value) || 0,
              })
            }
          />
        </Field>
        <Field label="Left">
          <Input
            type="number"
            value={theme.marginLeft}
            onChange={(e) =>
              onChange({
                ...theme,
                marginLeft: Number(e.target.value) || 0,
              })
            }
          />
        </Field>
        <Field label="Right">
          <Input
            type="number"
            value={theme.marginRight}
            onChange={(e) =>
              onChange({
                ...theme,
                marginRight: Number(e.target.value) || 0,
              })
            }
          />
        </Field>
      </div>

      <Separator />

      <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        Typography
      </p>

      <Field label="Font family">
        <Select
          value={theme.fontFamily}
          onValueChange={(v) =>
            onChange({ ...theme, fontFamily: v as DocumentTheme['fontFamily'] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Helvetica">Helvetica (sans)</SelectItem>
            <SelectItem value="Times-Roman">Times (serif)</SelectItem>
            <SelectItem value="Courier">Courier (mono)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Base font size (pt)">
        <Input
          type="number"
          value={theme.baseFontSize}
          onChange={(e) =>
            onChange({
              ...theme,
              baseFontSize: Number(e.target.value) || 11,
            })
          }
        />
      </Field>
    </div>
  )
}

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